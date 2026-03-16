/********************************************************************************
 * Copyright (c) 2022 Contributors to the Eclipse Foundation
 *
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Apache License, Version 2.0 which is available at
 * https://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ********************************************************************************/

const getNodeOrViewable = (c) => c.hasOwnProperty('view') ? c.view : c

const getTextNode = (c, tc) => document.createTextNode(tc === 'string' ? c : '' + c)

const append = (n, c) => {
    if (!(c instanceof Array)) c = [c]
    for (let i in c) {
        const tc = typeof c[i]
        if (tc !== 'undefined')
            try {
                n.appendChild(
                    tc === 'object'
                        ? getNodeOrViewable(c[i])
                        : getTextNode(c[i], tc)
                )
            } catch (e) {
                const pre = document.createElement('pre')
                pre.appendChild(document.createTextNode(JSON.stringify(c[i], null, 4)))
                n.appendChild(pre)
            }
    }
    return n
}

const N = (tag, c, att) => {
    const n = document.createElement(tag)
    if (att) for (let a of Object.keys(att)) n.setAttribute(a, att[a])
    if (typeof c === 'undefined' || c === null || c === false) return n
    return append(n, c)
}

const remove = (n) => {
    try {
        n.parentElement.removeChild(n)
    } catch (e) {
        // ignore
    }
    return n
}

const clear = (n) => {
    if (!n) return
    while (n.childNodes.length > 0) n.removeChild(n.firstChild)
    return n
}

const wrap = (c, p) => {
    const parent = c.parentElement
    parent.insertBefore(p, c)
    parent.removeChild(c)
    p.appendChild(c)
    return c
}

const addEvents = (node, evts) => {
    Object.keys(evts).forEach((key) => node.addEventListener(key, evts[key]))
    return node
}

class State {

    atts = {
        username: undefined,
        password: undefined,
        confirm: undefined,
        valid: [false],
    }

    listener = {
        username: [],
        password: [],
        confirm: [],
        valid: []
    }

    static getInstance() {
        return State.instance ?? (State.instance = new State())
    }

    addListener(att, listener) {
        if (Array.isArray(listener))
            this.listener[att].push(...listener)
        else
            this.listener[att].push(listener)
        return this
    }

    setValue(att, value) {
        if (this.atts[att] === value) {
            return
        }
        this.atts[att] = value
        this.listener[att].forEach((listener) => listener[`${att}Changed`](value))
        return this
    }

    addPasswordListener(listener) { this.addListener('password', listener) }

    addConfirmListener(listener) { this.addListener('confirm', listener) }

    addValidListener(listener) { this.addListener('valid', listener) }

    setUsername(value) { this.setValue('username', value) }

    setPassword(value) { this.setValue('password', value) }

    setConfirm(value) { this.setValue('confirm', value) }

    setValid(value) { this.setValue('valid', value) }

}

const Messages = {
    en: {
        OK_LENGTH: 'has a minimum length of 15 characters',
        HAS_LOWER: 'contains lower case characters [a-z]',
        HAS_UPPER: 'contains upper case characters [A-Z]',
        HAS_NUMBER: 'contains numbers [0-9]',
        HAS_SPECIAL: 'contains characters other than [a-z] [A-Z] [0-9]',
        OK_CONFIRM: 'confirmation and password are equal',
    }
}


class Validator {

    rules = [
        ['OK_LENGTH', /^.{15,200}$/],
        ['HAS_LOWER', /[a-z]/],
        ['HAS_UPPER', /[A-Z]/],
        ['HAS_NUMBER', /\d/],
        ['HAS_SPECIAL', /[^a-zA-Z0-9]/],
        ['OK_CONFIRM', (expr) => expr !== '' && expr === State.getInstance().atts.confirm],
    ]

    static getInstance() {
        return Validator.instance ?? (Validator.instance = new Validator())
    }

    constructor() {
        this.state = State.getInstance()
        this.state.addPasswordListener(this)
        this.state.addConfirmListener(this)
    }

    passwordChanged(value) {
        this.password = value
        this.checkValid()
    }

    confirmChanged(value) {
        this.confirm = value
        this.checkValid()
    }

    checkRule(rule) {
        const check = rule[1]
        if (check instanceof RegExp)
            return !!this.password.match(check)
        else if (check instanceof Function)
            return check(this.password)
        return false
    }

    checkValid() {
        this.state.setValid(
            this.rules.map(this.checkRule.bind(this))
        )
    }

}

class Viewable {

    constructor(view) {
        this.view = view
    }

    getView() {
        return this.view
    }

    append(c) {
        append(this.getView(), c)
        return this
    }

    appendTo(p) {
        append(p, this.getView())
        return this
    }

    detach() {
        remove(this.view)
        return this
    }

    clear() {
        clear(this.view)
        return this
    }

}

class Card extends Viewable {

    constructor(name) {
        super(
            addEvents(
                N('div',
                    [
                        N('div',
                            N('div', 'switch company', { class: 'switch' }),
                            { class: 'overlay' }
                        ),
                        N('div', null, { class: 'card-image' }),
                        N('div', name, { class: 'card-name' }),
                    ], { class: 'card' }
                ),
                {
                    click: (e) => {
                        e.preventDefault()
                        history.back()
                    }
                }
            )
        )
    }

}

class Form extends Viewable {

    static fromPage() {
        try {
            const form = document.getElementsByTagName('form').item(0)
            switch (form.id) {
                case 'kc-form-login': return new FormLogin(form)
                case 'kc-passwd-update-form': return new FormUpdate(form)
                case 'kc-reset-passwd-form': return new FormReset(form)
            }
        } catch (e) {
            return null
        }
    }

    constructor(form) {
        super(form)
    }

    appendPasswordButton(password) {
        const toggle = addEvents(
            N('div', null, { class: 'hidden' }),
            {
                click: ((e) => {
                    e.preventDefault()
                    const input = e.currentTarget.previousSibling
                    const isHidden = input.getAttribute('type') === 'password'
                    input.setAttribute('type', isHidden ? 'text' : 'password')
                    e.currentTarget.className = isHidden ? 'visible' : 'hidden'
                    //document.getElementById('password').focus()
                }).bind(this)
            }
        )
        const wrapper = N('div', null, { class: 'pwwrapper' })
        wrap(password, wrapper)
        wrapper.appendChild(toggle)
        return this
    }

}

class FormLogin extends Form {

    constructor(form) {
        super(form)
        this.adjustSequence()
        setTimeout((() => {
            this.appendPasswordButton(document.getElementById('username'))
            this.appendPasswordButton(document.getElementById('password'))
            document.getElementById('username').focus()
        }).bind(this), 300)
    }

    adjustSequence() {
        const forgot = [...this.view.children][2]
        this.view.removeChild(forgot)
        this.view.appendChild(forgot)
        const links = [...forgot.getElementsByTagName('a')]
        if (links.length === 0)
            return
        const parent = links[links.length - 1].parentElement
        parent.appendChild(
            addEvents(
                N('a', 'Sign in with another company', { href: '#' }),
                {
                    click: (e) => {
                        e.preventDefault()
                        history.back()
                    }
                }
            )
        )
        return this
    }

}

class PasswordPolicyHint extends Viewable {

    constructor() {
        super(
            N('ul', null, { class: 'password-policy-hint' })
        )
        this.hints = Validator.getInstance().rules.map(rule => N('li', Messages.en[rule[0]]))
        this.append(this.hints)
        State.getInstance().addValidListener(this)
    }

    validChanged(valid) {
        valid.forEach((v, i) => this.hints[i].className = v ? 'valid' : 'invalid')
    }

}

class FormUpdate extends Form {

    constructor(form) {
        super(form)

        State.getInstance().addValidListener(this)

        setTimeout((() => {
            const password = document.getElementById('password-new')
            this.setItems()
                .appendPasswordButton(
                    addEvents(
                        password,
                        {
                            'keyup': (e) => this.checkPolicy('password', e.currentTarget.value),
                            'focus': (e) => this.checkPolicy('password', e.currentTarget.value),
                        }
                    )
                )
                .appendPasswordButton(
                    addEvents(
                        document.getElementById('password-confirm'),
                        {
                            'keyup': (e) => this.checkPolicy('confirm', e.currentTarget.value),
                            'focus': (e) => this.checkPolicy('confirm', e.currentTarget.value),
                        }
                    )
                )
            password.focus()
        }).bind(this), 300)
    }

    setItems() {
        const items = [...document.querySelectorAll('#kc-passwd-update-form>div')]
        this.section = {
            password: items[0],
            confirm: items[1],
            submit: items[2],
            policy: new PasswordPolicyHint().getView(),
        }
        this.button = document.querySelectorAll('input[type=submit]')[0]
        this.button.setAttribute('disabled', '')
        State.getInstance().setUsername(document.getElementById('username')?.value ?? '')
        Validator.getInstance()
        return this
    }

    checkPolicy(att, value) {
        this.getView().insertBefore(remove(this.section.policy), this.section.submit)
        State.getInstance().setValue(att, value)
    }

    validChanged(valid) {
        if (valid.reduce((a, o) => a && o))
            this.button.removeAttribute('disabled')
        else
            this.button.setAttribute('disabled', '')
    }

}

class FormReset extends Form {

    constructor(form) {
        super(form)
    }

}

class Section extends Viewable {

    constructor() {
        super(N('section'))
    }

}

class App extends Viewable {

    constructor(clear) {
        super(document.body)
        this.setIcon()
        if (clear)
            this.clear()
    }

    setIcon() {
        let icon = document.querySelectorAll('link[rel=icon]')[0]
        if (!icon) {
            icon = document.createElement('link')
            icon.rel = 'icon'
            document.head.appendChild(icon)
        }
        icon.href = 'data:image/x-icon;base64,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'
        return this
    }

}

class Header extends Viewable {

    constructor(title) {
        super(
            N('header', [
                N('h3', title)
            ])
        )
    }

}

class Main extends Viewable {

    constructor() {
        super(N('main'))
    }

}

class Footer extends Viewable {

    constructor() {
        super(
            N('footer', [
                N('div', '', { class: 'links' }),
                N('div', 'Copyright © Catena-X Automotive Network.', { class: 'copy' })
            ])
        )
    }

}

addEvents(
    window,
    {
        load: () => {
            const title = document.getElementsByTagName('h1').item(0).firstChild.data
            const realm = document.getElementById('kc-header-wrapper').firstChild.data
            const content = document.getElementById('kc-content')
            const form = Form.fromPage()
            new App(true)
                .append(new Header(title).append(content))
                .append(
                    new Main().append(
                        new Section()
                            .append(new Card(realm))
                            .append(form || content)
                    )
                )
                .append(new Footer())
        }
    }
)
