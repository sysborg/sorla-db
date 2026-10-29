const chai = require('chai')
const expect = chai.expect
const { JSDOM } = require('jsdom')
const sorla = require('../src/sorla.js')

const schema = {
    required: ['name', 'email'],
    properties: {
        name: { type: 'string', minLength: 2, title: 'Full name' },
        email: { type: 'string', format: 'email', description: 'We never share it' },
        age: { type: ['integer', 'null'], minimum: 0, maximum: 130 },
        role: { enum: ['admin', 'user'], default: 'user' },
        active: { type: 'boolean', default: true },
        tags: { type: 'array', items: { type: 'string' } },
        skills: { type: 'array', items: { enum: ['js', 'php', 'sql'] } },
        born: { type: 'date' },
        address: { type: 'object', properties: { zip: { type: 'string', pattern: '^\\d{5}-\\d{3}$' }, city: { type: 'string' } } }
    }
};

let counter = 0;
function setup(html, collectionSchema = schema) {
    const dom = new JSDOM(`<!doctype html><body>${html}</body>`);
    const srla = new sorla();
    srla.useDb(`form${++counter}`);
    srla.db.createCollection('users', collectionSchema);
    const document = dom.window.document;
    return { window: dom.window, document, users: srla.db.users, form: document.querySelector('form') };
}

const handWritten = `
<form id="user">
  <input name="name">
  <input name="email" type="email">
  <input name="age" type="number">
  <select name="role"><option value="admin">admin</option><option value="user">user</option></select>
  <input name="active" type="checkbox">
  <input name="tags" data-sorla-list>
  <input name="skills" type="checkbox" value="js"><input name="skills" type="checkbox" value="php"><input name="skills" type="checkbox" value="sql">
  <input name="born" type="date">
  <input name="address.zip"><input name="address.city" value="Ribeirão Preto">
  <button>Save</button>
</form>`;

const set = (form, name, value) => { form.elements[name].value = value; };
const submit = (window, form) => form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
const errorText = (form, name) => form.querySelector(`[data-error-for="${name}"]`)?.textContent ?? '';

describe('SORLA bindForm: insert', () => {
    it('converts values with the schema and inserts the document', () => {
        const { window, form, users } = setup(handWritten);
        const saved = [];
        form.addEventListener('sorla:saved', e => saved.push(e.detail));
        const controller = users.bindForm(form, { onSuccess: result => saved.push(result.mode) });

        expect(form.elements.role.value, 'defaults are filled').to.equal('user');
        expect(form.elements.active.checked).to.equal(true);
        expect(form.elements['address.city'].value, 'values written in the HTML are kept').to.equal('Ribeirão Preto');

        set(form, 'name', 'Ana');
        set(form, 'email', 'ana@mail.com');
        set(form, 'age', '30');
        set(form, 'tags', 'a, b ,, c');
        form.querySelector('[name="skills"][value="sql"]').checked = true;
        set(form, 'born', '1996-05-20');
        set(form, 'address.zip', '14000-000');
        expect(controller.values()).to.deep.include({ name: 'Ana', age: 30, tags: ['a', 'b', 'c'], skills: ['sql'] });
        submit(window, form);

        const doc = users.findOne({ name: 'Ana' });
        expect(doc).to.deep.include({ email: 'ana@mail.com', age: 30, role: 'user', active: true, tags: ['a', 'b', 'c'], skills: ['sql'] });
        expect(doc.address).to.deep.equal({ zip: '14000-000', city: 'Ribeirão Preto' });
        expect(Object.prototype.toString.call(doc.born)).to.equal('[object Date]');
        expect(doc.born.toISOString()).to.equal('1996-05-20T00:00:00.000Z');
        expect(saved[0].id).to.equal(doc._id);
        expect(saved[1]).to.equal('insert');
        expect(form.elements.name.value, 'form reset after insert').to.equal('');
    });

    it('shows every error next to its field and inserts nothing', () => {
        const { window, form, users } = setup(handWritten);
        const invalid = [];
        form.addEventListener('sorla:invalid', e => invalid.push(e.detail.errors.length));
        let onError = null;
        users.bindForm(form, { onError: errors => { onError = errors; } });
        set(form, 'name', 'A');
        set(form, 'email', 'nope');
        set(form, 'age', '-1');
        set(form, 'address.zip', '123');
        submit(window, form);

        expect(users.count()).to.equal(0);
        expect(errorText(form, 'name')).to.equal('name must have at least 2 characters');
        expect(errorText(form, 'email')).to.equal('email must be a valid email');
        expect(errorText(form, 'age')).to.equal('age must be >= 0');
        expect(errorText(form, 'address.zip')).to.match(/must match/);
        expect(form.elements.email.getAttribute('aria-invalid')).to.equal('true');
        const describedBy = form.elements.email.getAttribute('aria-describedby');
        expect(form.ownerDocument.getElementById(describedBy).textContent).to.equal('email must be a valid email');
        expect(invalid).to.deep.equal([4]);
        expect(onError.map(e => e.path)).to.deep.equal(['name', 'email', 'age', 'address.zip']);
        expect(form.noValidate, 'native validation bubbles are off by default').to.equal(true);

        set(form, 'name', 'Ana');
        set(form, 'email', 'ana@mail.com');
        set(form, 'age', '');
        set(form, 'address.zip', '');
        submit(window, form);
        expect(users.count()).to.equal(1);
        expect(form.elements.email.hasAttribute('aria-invalid'), 'errors cleared').to.equal(false);
        expect(errorText(form, 'email')).to.equal('');
    });

    it('validates on blur only the fields the user already left', () => {
        const { window, form, users } = setup(handWritten);
        users.bindForm(form);
        set(form, 'email', 'nope');
        form.elements.email.dispatchEvent(new window.Event('focusout', { bubbles: true }));
        expect(errorText(form, 'email')).to.equal('email must be a valid email');
        expect(errorText(form, 'name'), 'untouched required field is not reported yet').to.equal('');
        set(form, 'email', 'ana@mail.com');
        form.elements.email.dispatchEvent(new window.Event('input', { bubbles: true }));
        form.elements.email.dispatchEvent(new window.Event('change', { bubbles: true }));
        expect(errorText(form, 'email')).to.equal('');
    });

    it('a failure that is not about validation is shown at the top of the form', () => {
        const { window, document, users } = setup('<form><input name="_id"><input name="name"><input name="email"></form>');
        users.insertOne({ _id: 'x', name: 'Ana', email: 'a@mail.com' });
        const form = document.querySelector('form');
        users.bindForm(form);
        form.elements._id.value = 'x';
        form.elements.name.value = 'Bia';
        form.elements.email.value = 'b@mail.com';
        submit(window, form);
        const summary = form.querySelector('[data-error-for=""]');
        expect(summary.getAttribute('role')).to.equal('alert');
        expect(summary.textContent).to.equal('Duplicate _id "x"');
    });
});

describe('SORLA bindForm: update', () => {
    it('fills the form and saves only what changed, keeping fields outside the form', () => {
        const { window, form, users } = setup(handWritten);
        users.insertOne({ _id: 'u1', name: 'Ana', email: 'a@mail.com', age: 30, born: new Date('1996-05-20'), skills: ['js'], address: { zip: '14000-000', city: 'A' }, internal: 'keep me' });
        const changes = [];
        users.on('update', e => changes.push(e.documents[0]));
        const controller = users.bindForm(form, { mode: 'update', id: 'u1' });

        expect(form.elements.name.value).to.equal('Ana');
        expect(form.elements.born.value).to.equal('1996-05-20');
        expect(form.elements['address.city'].value).to.equal('A');
        expect(form.querySelector('[name="skills"][value="js"]').checked).to.equal(true);

        set(form, 'age', '');
        set(form, 'address.city', 'Recife');
        const result = controller.submit();
        expect(result).to.include({ ok: true, mode: 'update', id: 'u1', modified: true });
        const doc = users.findOne({ _id: 'u1' });
        expect(doc).to.not.have.property('age');
        expect(doc.address).to.deep.equal({ zip: '14000-000', city: 'Recife' });
        expect(doc.internal).to.equal('keep me');
        expect(changes.length).to.equal(1);

        expect(controller.submit().modified, 'nothing changed: no update').to.equal(false);
        expect(changes.length).to.equal(1);
        submit(window, form);
        expect(changes.length).to.equal(1);
    });

    it('validates the merged document, load() switches documents', () => {
        const { form, users } = setup(handWritten);
        users.insertMany([{ _id: 'a', name: 'Ana', email: 'a@mail.com' }, { _id: 'b', name: 'Bia', email: 'b@mail.com' }]);
        const controller = users.bindForm(form, { mode: 'update', id: 'a' });
        set(form, 'email', '');
        expect(controller.submit().errors.map(e => e.path)).to.deep.equal(['email']);
        expect(errorText(form, 'email')).to.equal('email is required');
        expect(users.findOne({ _id: 'a' }).email).to.equal('a@mail.com');

        controller.load('b');
        expect(form.elements.name.value).to.equal('Bia');
        expect(errorText(form, 'email'), 'load clears errors').to.equal('');
        expect(controller.id).to.equal('b');
        expect(() => controller.load('zzz')).to.throw('No document with _id "zzz"');
    });

    it('reset restores the loaded document', async () => {
        const { window, form, users } = setup(handWritten);
        users.insertOne({ _id: 'a', name: 'Ana', email: 'a@mail.com' });
        users.bindForm(form, { mode: 'update', id: 'a' });
        set(form, 'name', 'changed');
        form.reset();
        await new Promise(resolve => window.setTimeout(resolve, 0));
        await new Promise(resolve => window.setTimeout(resolve, 0));
        expect(form.elements.name.value).to.equal('Ana');
    });
});

describe('SORLA bindForm: generated fields', () => {
    it('builds labeled inputs from the schema and saves through them', () => {
        const { window, form, users } = setup('<form id="signup"><button>Create</button></form>');
        users.bindForm(form, { generate: true });

        const control = name => form.querySelector(`[name="${name}"]`);
        expect(control('name').type).to.equal('text');
        expect(control('name').getAttribute('minlength')).to.equal('2');
        expect(form.querySelector(`label[for="${control('name').id}"]`).textContent).to.equal('Full name *');
        expect(control('email').type).to.equal('email');
        expect(control('email').getAttribute('aria-describedby')).to.match(/hint/);
        expect(control('age').type).to.equal('number');
        expect(control('age').getAttribute('max')).to.equal('130');
        expect(control('role').tagName).to.equal('SELECT');
        expect(control('role').value, 'default selected').to.equal('user');
        expect(control('active').type).to.equal('checkbox');
        expect(control('active').checked).to.equal(true);
        expect(control('tags').hasAttribute('data-sorla-list')).to.equal(true);
        expect(form.querySelectorAll('[name="skills"]').length).to.equal(3);
        expect(control('born').type).to.equal('date');
        expect(form.querySelector('fieldset[data-sorla-path="address"] legend').textContent).to.equal('Address');
        expect(control('address.zip')).to.not.equal(null);
        expect(form.querySelector('[data-sorla-fields]').nextElementSibling.textContent, 'fields go before the submit button').to.equal('Create');

        control('name').value = 'Carla';
        control('email').value = 'carla@mail.com';
        form.querySelector('[name="skills"][value="php"]').checked = true;
        submit(window, form);
        expect(users.findOne({ name: 'Carla' })).to.deep.include({ role: 'user', active: true, skills: ['php'] });
    });

    it('needs a JSON schema', () => {
        const { form, users } = setup('<form></form>', doc => true);
        expect(() => users.bindForm(form, { generate: true })).to.throw('generate needs a collection with a JSON schema');
    });
});

describe('SORLA bindForm: options and lifecycle', () => {
    it('radios, multiple selects, translated messages and custom error elements', () => {
        const { window, form, users } = setup(`
            <form>
              <input name="name"><input name="email"><span data-error-for="email" class="mine"></span>
              <input type="radio" name="role" value="admin"><input type="radio" name="role" value="user">
              <select name="skills" multiple><option>js</option><option>php</option><option>sql</option></select>
            </form>`);
        users.bindForm(form, { messages: issue => issue.rule === 'required' ? `${issue.path} é obrigatório` : null });
        form.elements.name.value = 'Ana';
        form.querySelector('[name="role"][value="admin"]').checked = true;
        form.elements.skills.options[0].selected = true;
        form.elements.skills.options[2].selected = true;
        submit(window, form);
        expect(form.querySelector('span.mine').textContent).to.equal('email é obrigatório');
        form.elements.email.value = 'a@mail.com';
        submit(window, form);
        expect(users.findOne({})).to.deep.include({ role: 'admin', skills: ['js', 'sql'] });
    });

    it('works without a schema', () => {
        const { window, document } = setup('');
        const srla = new sorla();
        srla.useDb('free');
        srla.db.createCollection('notes');
        document.body.innerHTML = '<form><input name="title"><input name="pages" type="number"><input name="done" type="checkbox"></form>';
        const form = document.querySelector('form');
        srla.db.notes.bindForm(form);
        form.elements.title.value = 'x';
        form.elements.pages.value = '12';
        submit(window, form);
        expect(srla.db.notes.findOne({})).to.deep.include({ title: 'x', pages: 12, done: false });
    });

    it('destroy() stops listening and removes what it created', () => {
        const { window, form, users } = setup('<form><button>Create</button></form>');
        const controller = users.bindForm(form, { generate: true });
        controller.submit();
        expect(form.querySelector('.sorla-error')).to.not.equal(null);
        controller.destroy();
        expect(form.querySelector('[data-sorla-fields]')).to.equal(null);
        expect(form.querySelector('.sorla-error')).to.equal(null);
        expect(form.noValidate).to.equal(false);
        submit(window, form);
        expect(users.count()).to.equal(0);
    });

    it('rejects invalid arguments', () => {
        const { document, users } = setup('<div id="nope"></div><form></form>');
        expect(() => users.bindForm(document.querySelector('#nope'))).to.throw('needs a <form>');
        expect(() => users.bindForm('#nope', { document })).to.throw('needs a <form>');
        const form = document.querySelector('form');
        expect(() => users.bindForm(form, { mode: 'edit' })).to.throw('mode must be');
        expect(() => users.bindForm(form, { mode: 'update' })).to.throw('needs the id');
        expect(() => users.bindForm(form, { validateOn: 'never' })).to.throw('validateOn must be');
    });
});
