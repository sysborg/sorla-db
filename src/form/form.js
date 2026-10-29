/**
 * Binds an HTML form to a collection: fields map to document fields by their name ("address.zip"
 * for nested ones), values are converted with the collection schema, errors are shown next to each
 * field, and submitting inserts or updates the document.
 *
 *   const form = sorla.db.users.bindForm('#user', { mode: 'update', id: 'u1' });
 *
 * Only DOM APIs reachable from the form itself are used (form.ownerDocument), so it works in
 * iframes and with jsdom.
 */
const DEFAULTS = {
    mode: 'insert',
    id: undefined,
    generate: false,
    validateOn: 'blur',
    resetOnInsert: true,
    nativeValidation: false,
    messages: null,
    onSuccess: null,
    onError: null
};

const EMPTY = Symbol('empty');
const isPlainObject = value => Object.prototype.toString.call(value) === '[object Object]';
const isDate = value => Object.prototype.toString.call(value) === '[object Date]';
const typesOf = schema => schema && schema.type !== undefined ? (Array.isArray(schema.type) ? schema.type : [schema.type]) : [];
const humanize = name => name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, c => c.toUpperCase());

function getPath(data, path)
{
    let value = data;
    for(const part of path.split('.'))
    {
        if(value === null || typeof value !== 'object' || !(part in value))
            return undefined;
        value = value[part];
    }
    return value;
}

function setPath(data, path, value)
{
    const parts = path.split('.');
    let target = data;
    for(const part of parts.slice(0, -1))
    {
        if(!isPlainObject(target[part]))
            target[part] = {};
        target = target[part];
    }
    target[parts.at(-1)] = value;
}

const same = (a, b) => {
    if(isDate(a) && isDate(b)) return a.getTime() === b.getTime();
    return JSON.stringify(a) === JSON.stringify(b);
};

/**
 * Schema of a dotted field path, or null
 */
function schemaFor(root, path)
{
    let schema = root;
    for(const part of path.split('.'))
    {
        if(!schema || !isPlainObject(schema.properties) || !schema.properties[part])
            return null;
        schema = schema.properties[part];
    }
    return schema;
}

/**
 * Converts the text of an input into the type the schema expects
 */
function convert(text, schema, element)
{
    const types = typesOf(schema);
    if(schema && Array.isArray(schema.enum))
    {
        const option = schema.enum.find(value => String(value) === text);
        if(option !== undefined) return option;
    }

    if(types.includes('integer') || types.includes('number') || (!types.length && (element.type === 'number' || element.type === 'range')))
    {
        const number = Number(text);
        // keep invalid text so validation reports the type instead of silently dropping it
        return text.trim() !== '' && Number.isFinite(number) ? number : text;
    }

    if(types.includes('boolean')) return text === 'true' || text === 'on';

    if(types.includes('date'))
    {
        const date = new Date(element.type === 'date' ? `${text}T00:00:00Z` : text);
        return isNaN(date.getTime()) ? text : date;
    }

    return text;
}

function controlsByName(form)
{
    const groups = new Map();
    for(const element of form.elements)
    {
        if(!element.name || element.disabled || ['submit', 'button', 'reset', 'image', 'file'].includes(element.type) || element.tagName === 'FIELDSET' || element.tagName === 'OUTPUT')
            continue;
        if(!groups.has(element.name)) groups.set(element.name, []);
        groups.get(element.name).push(element);
    }
    return groups;
}

function readControl(elements, schema)
{
    const first = elements[0];
    const types = typesOf(schema);
    const itemSchema = schema && schema.items;

    if(first.type === 'checkbox')
    {
        if(elements.length > 1 || types.includes('array'))
            return elements.filter(el => el.checked).map(el => convert(el.value, itemSchema, el));
        if(types.includes('boolean') || !types.length || first.value === 'on')
            return first.checked;
        return first.checked ? convert(first.value, schema, first) : EMPTY;
    }

    if(first.type === 'radio')
    {
        const checked = elements.find(el => el.checked);
        return checked ? convert(checked.value, schema, checked) : EMPTY;
    }

    if(first.tagName === 'SELECT' && first.multiple)
        return [...first.selectedOptions].map(option => convert(option.value, itemSchema, first));

    const text = first.value;
    if(text === '')
        return types.includes('array') ? [] : EMPTY;

    if(types.includes('array') || first.hasAttribute('data-sorla-list'))
        return text.split(',').map(item => item.trim()).filter(Boolean).map(item => convert(item, itemSchema, first));

    return convert(text, schema, first);
}

function writeControl(elements, value)
{
    const first = elements[0];
    const list = Array.isArray(value) ? value.map(String) : null;

    if(first.type === 'checkbox')
    {
        if(elements.length > 1 || list)
            elements.forEach(el => { el.checked = (list ?? []).includes(el.value); });
        else
            first.checked = first.value === 'on' ? value === true : String(value) === first.value || value === true;
        return;
    }

    if(first.type === 'radio')
    {
        elements.forEach(el => { el.checked = value !== undefined && value !== null && String(value) === el.value; });
        return;
    }

    if(first.tagName === 'SELECT' && first.multiple)
    {
        for(const option of first.options) option.selected = (list ?? []).includes(option.value);
        return;
    }

    if(value === undefined || value === null) first.value = '';
    else if(isDate(value)) first.value = first.type === 'datetime-local' ? value.toISOString().slice(0, 16) : value.toISOString().slice(0, 10);
    else if(list) first.value = list.join(', ');
    else first.value = String(value);
}

/**
 * Builds labeled fields for every property of the schema
 */
function generateFields(form, schema)
{
    const doc = form.ownerDocument;
    const make = (tag, attrs = {}, text) => {
        const element = doc.createElement(tag);
        for(const [key, value] of Object.entries(attrs))
        {
            if(value === undefined || value === null || value === false) continue;
            element.setAttribute(key, value === true ? '' : String(value));
        }
        if(text !== undefined) element.textContent = text;
        return element;
    };
    const formId = form.id || `form${Math.random().toString(36).slice(2, 8)}`;
    const idFor = path => `sorla-${formId}-${path.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

    const build = (objectSchema, prefix, container) => {
        const required = new Set(objectSchema.required ?? []);
        for(const [name, prop] of Object.entries(objectSchema.properties ?? {}))
        {
            const path = prefix ? `${prefix}.${name}` : name;
            const types = typesOf(prop);
            const title = prop.title ?? humanize(name);

            if(types.includes('object') && isPlainObject(prop.properties))
            {
                const fieldset = make('fieldset', { class: 'sorla-group', 'data-sorla-path': path });
                fieldset.append(make('legend', {}, title));
                build(prop, path, fieldset);
                container.append(fieldset);
                continue;
            }

            const id = idFor(path);
            const wrapper = make('div', { class: 'sorla-field', 'data-sorla-path': path });
            const label = make('label', { for: id }, title);
            if(required.has(name)) label.append(make('span', { class: 'sorla-required', 'aria-hidden': 'true' }, ' *'));
            const common = { id, name: path, 'aria-required': required.has(name) ? 'true' : null };
            let control;

            if(Array.isArray(prop.enum))
            {
                control = make('select', common);
                if(!required.has(name) || prop.default === undefined) control.append(make('option', { value: '' }, ''));
                for(const option of prop.enum) control.append(make('option', { value: String(option) }, String(option)));
            }
            else if(types.includes('boolean'))
            {
                control = make('input', { ...common, type: 'checkbox' });
                wrapper.append(control, label);
            }
            else if(types.includes('integer') || types.includes('number'))
            {
                control = make('input', { ...common, type: 'number', min: prop.minimum, max: prop.maximum, step: types.includes('integer') && !types.includes('number') ? 1 : 'any' });
            }
            else if(types.includes('date'))
            {
                control = make('input', { ...common, type: 'date' });
            }
            else if(types.includes('array'))
            {
                const items = prop.items ?? {};
                if(Array.isArray(items.enum))
                {
                    control = make('fieldset', { class: 'sorla-options', id });
                    control.append(make('legend', {}, title));
                    items.enum.forEach((option, index) => {
                        const optionId = `${id}-${index}`;
                        control.append(make('input', { type: 'checkbox', id: optionId, name: path, value: String(option) }), make('label', { for: optionId }, String(option)));
                    });
                    wrapper.append(control);
                    container.append(wrapper);
                    continue;
                }
                control = make('input', { ...common, type: 'text', 'data-sorla-list': true, placeholder: 'a, b, c' });
            }
            else
            {
                const inputType = { email: 'email', uri: 'url', date: 'date', 'date-time': 'datetime-local' }[prop.format] ?? 'text';
                const long = prop.maxLength !== undefined && prop.maxLength > 120;
                control = make(long ? 'textarea' : 'input', { ...common, type: long ? null : inputType, minlength: prop.minLength, maxlength: prop.maxLength, pattern: prop.pattern });
            }

            if(!control.isConnected && !wrapper.contains(control)) wrapper.append(label, control);
            if(prop.description)
            {
                const hint = make('small', { class: 'sorla-hint', id: `${id}-hint` }, prop.description);
                control.setAttribute('aria-describedby', hint.id);
                wrapper.append(hint);
            }
            container.append(wrapper);
        }
    };

    let container = form.querySelector('[data-sorla-fields]');
    if(!container)
    {
        container = make('div', { 'data-sorla-fields': true, 'data-sorla-generated': true });
        const submit = form.querySelector('[type="submit"], button:not([type])');
        if(submit) submit.before(container);
        else form.append(container);
    }
    build(schema, '', container);
    return container;
}

/**
 * @param collection collection
 * @param string|HTMLFormElement target
 * @param object options see DEFAULTS
 * @return object controller
 */
function bindForm(collection, target, options = {})
{
    const opts = { ...DEFAULTS, ...options };
    const form = typeof target === 'string' ? (opts.document ?? globalThis.document)?.querySelector(target) : target;
    if(!form || form.tagName !== 'FORM')
        throw new Error('bindForm needs a <form> element or a selector that finds one');

    if(!['insert', 'update'].includes(opts.mode))
        throw new Error('mode must be "insert" or "update"');

    if(opts.mode === 'update' && opts.id === undefined)
        throw new Error('mode "update" needs the id of the document');

    if(!['blur', 'input', 'submit'].includes(opts.validateOn))
        throw new Error('validateOn must be "blur", "input" or "submit"');

    const doc = form.ownerDocument;
    const win = doc.defaultView;
    const source = collection.getSchema();
    const schema = isPlainObject(source) ? { type: 'object', ...source } : null;
    const previousNoValidate = form.noValidate;
    if(!opts.nativeValidation) form.noValidate = true;

    let generated = null;
    if(opts.generate)
    {
        if(!schema) throw new Error('generate needs a collection with a JSON schema');
        generated = generateFields(form, schema);
    }

    let currentId = opts.id;
    let loaded = null;
    const touched = new Set();
    const created = new Set();

    const fieldNames = () => [...controlsByName(form).keys()].sort((a, b) => b.length - a.length);

    function values()
    {
        const result = {};
        for(const [name, elements] of controlsByName(form))
        {
            const value = readControl(elements, schema && schemaFor(schema, name));
            if(value !== EMPTY) setPath(result, name, value);
        }
        return result;
    }

    function fill(document)
    {
        for(const [name, elements] of controlsByName(form))
            writeControl(elements, getPath(document ?? {}, name));
    }

    /**
     * Fills only the fields whose schema declares a default, keeping the values written in the HTML
     */
    function fillDefaults()
    {
        if(!schema) return;
        const defaults = collection.applyDefaults({});
        for(const [name, elements] of controlsByName(form))
        {
            const value = getPath(defaults, name);
            if(value !== undefined) writeControl(elements, value);
        }
    }

    function updateFor()
    {
        const update = {};
        for(const [name, elements] of controlsByName(form))
        {
            const value = readControl(elements, schema && schemaFor(schema, name));
            const before = getPath(loaded, name);
            if(value === EMPTY)
            {
                if(before !== undefined) (update.$unset ??= {})[name] = '';
            }
            else if(!same(value, before))
            {
                (update.$set ??= {})[name] = value;
            }
        }
        return update;
    }

    /**
     * The document the collection would validate: defaults applied on insert, merged on update
     */
    function candidate()
    {
        if(opts.mode === 'insert') return collection.applyDefaults(values());
        const next = structuredClone(loaded ?? {});
        for(const [name, elements] of controlsByName(form))
        {
            const value = readControl(elements, schema && schemaFor(schema, name));
            if(value === EMPTY)
            {
                const parts = name.split('.');
                const parent = parts.length > 1 ? getPath(next, parts.slice(0, -1).join('.')) : next;
                if(isPlainObject(parent)) delete parent[parts.at(-1)];
            }
            else
            {
                setPath(next, name, value);
            }
        }
        return next;
    }

    function fieldOf(path)
    {
        return fieldNames().find(name => path === name || path.startsWith(`${name}.`) || path.startsWith(`${name}[`)) ?? null;
    }

    const message = issue => (typeof opts.messages === 'function' && opts.messages(issue)) || issue.message;

    function errorElement(name)
    {
        const selector = `[data-error-for="${name.replace(/"/g, '\\"')}"]`;
        let element = form.querySelector(selector);
        if(!element)
        {
            element = doc.createElement(name ? 'small' : 'div');
            element.className = name ? 'sorla-error' : 'sorla-form-errors';
            element.setAttribute('data-error-for', name);
            element.setAttribute(name ? 'aria-live' : 'role', name ? 'polite' : 'alert');
            element.id = `sorla-error-${Math.random().toString(36).slice(2, 10)}`;
            // inside the field wrapper when there is one, otherwise right after the last control
            const last = name ? (controlsByName(form).get(name) ?? []).at(-1) : null;
            const wrapper = last?.closest('.sorla-field');
            if(wrapper) wrapper.append(element);
            else if(last) last.after(element);
            else form.prepend(element);
            created.add(element);
        }
        if(!element.id) element.id = `sorla-error-${Math.random().toString(36).slice(2, 10)}`;
        return element;
    }

    function clearErrors()
    {
        for(const element of form.querySelectorAll('[data-error-for]'))
        {
            element.textContent = '';
            element.hidden = true;
        }
        for(const element of form.querySelectorAll('[aria-invalid="true"]'))
        {
            element.removeAttribute('aria-invalid');
            const ids = (element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(id => id && !id.startsWith('sorla-error-'));
            if(ids.length) element.setAttribute('aria-describedby', ids.join(' '));
            else element.removeAttribute('aria-describedby');
        }
    }

    function showErrors(errors)
    {
        clearErrors();
        const byField = new Map();
        for(const issue of errors)
        {
            const name = fieldOf(issue.path) ?? '';
            if(!byField.has(name)) byField.set(name, []);
            byField.get(name).push(message(issue));
        }
        const groups = controlsByName(form);
        for(const [name, messages] of byField)
        {
            const element = errorElement(name);
            element.textContent = messages.join('. ');
            element.hidden = false;
            for(const control of groups.get(name) ?? [])
            {
                control.setAttribute('aria-invalid', 'true');
                const ids = new Set((control.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
                ids.add(element.id);
                control.setAttribute('aria-describedby', [...ids].join(' '));
            }
        }
    }

    /**
     * Validates the current values
     * @param boolean all show every error (true) or only those of fields the user already left
     * @return array errors
     */
    function validate(all = true)
    {
        const errors = collection.validate(candidate()).errors;
        const shown = all ? errors : errors.filter(issue => touched.has(fieldOf(issue.path)));
        showErrors(shown);
        return errors;
    }

    function emit(type, detail)
    {
        form.dispatchEvent(new win.CustomEvent(type, { detail, bubbles: true }));
    }

    function fail(errors)
    {
        showErrors(errors);
        emit('sorla:invalid', { errors });
        if(typeof opts.onError === 'function') opts.onError(errors);
        return { ok: false, errors };
    }

    /**
     * Inserts or updates the document from the form values
     * @return object {ok, mode, id, document, modified} or {ok: false, errors}
     */
    function submit()
    {
        let result;
        try
        {
            if(opts.mode === 'insert')
            {
                const id = collection.insertOne(values());
                result = { ok: true, mode: 'insert', id, document: collection.findOne({ _id: id }) };
                if(opts.resetOnInsert)
                {
                    form.reset();
                    touched.clear();
                }
            }
            else
            {
                const update = updateFor();
                const outcome = Object.keys(update).length ? collection.updateOne({ _id: currentId }, update) : { modifiedCount: 0 };
                loaded = collection.findOne({ _id: currentId });
                result = { ok: true, mode: 'update', id: currentId, document: loaded, modified: outcome.modifiedCount > 0 };
            }
        }
        catch(error)
        {
            if(error && error.name === 'ValidationError') return fail(error.errors);
            return fail([{ path: '', rule: 'error', message: error.message }]);
        }

        clearErrors();
        emit('sorla:saved', result);
        if(typeof opts.onSuccess === 'function') opts.onSuccess(result);
        return result;
    }

    /**
     * Loads a document into the form and switches to update mode
     */
    function load(id)
    {
        const document = collection.findOne({ _id: id });
        if(!document)
            throw new Error(`No document with _id "${id}"`);

        opts.mode = 'update';
        currentId = id;
        loaded = document;
        touched.clear();
        fill(document);
        clearErrors();
        return document;
    }

    const onSubmit = event => {
        event.preventDefault();
        submit();
    };
    const onLeave = event => {
        if(!event.target.name) return;
        touched.add(event.target.name);
        validate(false);
    };
    const onReset = () => {
        // the browser restores default values after the event, refill on the next tick
        win.setTimeout(() => {
            touched.clear();
            clearErrors();
            if(loaded) fill(loaded);
            else fillDefaults();
        });
    };

    form.addEventListener('submit', onSubmit);
    form.addEventListener('reset', onReset);
    if(opts.validateOn === 'blur')
    {
        form.addEventListener('focusout', onLeave);
        form.addEventListener('change', onLeave);
    }
    else if(opts.validateOn === 'input')
    {
        form.addEventListener('input', onLeave);
        form.addEventListener('change', onLeave);
    }

    if(opts.mode === 'update') load(opts.id);
    else fillDefaults();

    return {
        form,
        get mode() { return opts.mode; },
        get id() { return currentId; },
        values,
        fill,
        validate: () => validate(true),
        submit,
        load,
        reset: () => form.reset(),
        destroy()
        {
            form.removeEventListener('submit', onSubmit);
            form.removeEventListener('reset', onReset);
            form.removeEventListener('focusout', onLeave);
            form.removeEventListener('change', onLeave);
            form.removeEventListener('input', onLeave);
            clearErrors();
            for(const element of created) element.remove();
            if(generated) generated.remove();
            form.noValidate = previousNoValidate;
        }
    };
}

module.exports = { bindForm, generateFields };
