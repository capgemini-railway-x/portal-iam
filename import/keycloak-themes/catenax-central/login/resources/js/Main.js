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
const SEARCH_VALIDATION_REGEX =
    /^[a-zA-ZÀ-ÿŚął\d][a-zA-ZÀ-ÿŚął\d !#'$@&%()*+,\-_./:;=<>?[\]\\^]{0,255}$/

const remove = (n) => n.parentElement.removeChild(n)

const clear = (n) => {
    if (!n) return
    while (n.childNodes.length > 0) n.removeChild(n.firstChild)
    return n
}

const addEvents = (node, evts) => {
    Object.keys(evts).forEach((key) => node.addEventListener(key, evts[key]))
    return node
}

const escapeNames = (string) => string
    .split('\n')
    .map(line => line.match(/^\s+"name": "/)
        ? `"name": "${line.trim().substring(9, line.trim().length - 2).replaceAll('"', "\\\"")}",`
        : line
    )
    .join('\n')

const getSelectedIDP = (providers) => {
    let idp
    try {
        const params = new URLSearchParams(location.search)
        const redURI = params.get('redirect_uri')
        const redParams = new URLSearchParams(redURI.replace(/^[^?]+/, ''))
        const alias = redParams.get('with_idp')
        idp = providers.filter(p => p.alias === alias)[0].name
    } catch (e) {
    }
    return idp || localStorage.getItem('IDP') || ''
}

function debounce(func, timeout = 220) {
    let timer
    return (...args) => {
        clearTimeout(timer)
        timer = setTimeout(() => func.apply(this, args), timeout)
    }
}

const processChange = debounce((e) => Selector.filter(e))

class Viewable {
    getView() {
        return this.view
    }

    append(p) {
        this.getView().appendChild(p instanceof HTMLElement ? p : p.getView())
        return this
    }

    appendTo(p) {
        (p instanceof HTMLElement ? p : p.getView()).appendChild(this.getView())
        return this
    }
}

class SearchInput extends Viewable {

    constructor(providers) {
        super()
        this.input = addEvents(
            N('input', null, {
                type: 'search',
                class: 'search',
                placeholder: 'Enter your company name',
                value: getSelectedIDP(providers),
            }),
            {
                keyup: (e) => processChange(e.target.value),
                search: (e) => processChange(e.target.value),
            }
        )
        this.view = N('div', this.input, { class: 'search-container' })
        this.view.firstChild.select()
    }

    focus() {
        this.input.focus()
        return this
    }
}

class SelectProvider extends Viewable {
    constructor(providers) {
        super()
        this.providers = providers
        this.view = N('div')
    }

    displayError(expr) {
        this.view.appendChild(
            N(
                'div',
                [
                    N('p', 'No results found for', { class: 'error-main' }),
                    N('p', `"${expr}"`, { class: 'error-subtitle' }),
                    N('p', 'Please check your entry for typing errors.', {
                        class: 'error-subtitle-2',
                    }),
                    addEvents(
                        N('button', [N('span', 'Show '), 'list of all companies again'], {
                            class: 'error-button',
                        }),
                        {
                            click: () => {
                                clear(this.view)
                                this.appendSearchResult(this.providers)
                            },
                        }
                    ),
                ],
                { class: 'error-container' }
            )
        )
    }

    appendSearchResult(filteredProviders) {
        this.view.appendChild(
            N(
                'ul',
                filteredProviders.map(
                    (p) =>
                        N(
                            'li',
                            addEvents(
                                N('a', [
                                    N('div', '', { class: `idp-main ${p.alias.replace(/-/g, '_')}` }),
                                    N('div', p.name, { class: 'idp-name' }),
                                ], {
                                    href: p.url.match(/^https?:\/\//)
                                        ? p.url
                                        : `${location.origin}${p.url}`,
                                }),
                                {
                                    click: () => {
                                        localStorage.setItem('IDP', p.name)
                                    },
                                }
                            ),
                            { class: 'idp-card' }
                        )
                )
            )
        )
    }

    filter(expr) {
        clear(this.view)

        expr = expr.trim()
        expr = expr || expr === ''
            ? expr.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&')
            : '.'

        if (expr && !SEARCH_VALIDATION_REGEX.test(expr)) {
            this.displayError(expr)
            return this
        }

        const filteredProviders = this.providers.filter((n) =>
            n.name.toLowerCase().match(expr?.toLowerCase())
        )

        if (filteredProviders.length === 0) {
            this.displayError(expr || ' ')
            return this
        }

        this.appendSearchResult(filteredProviders)

        return this
    }
}

class Page extends Viewable {
    constructor() {
        super()
        this.view = document.body
    }
}

class Header extends Viewable {
    constructor() {
        super()
        this.view = N(
            'header',
            [
                N('div', null, { class: 'logo' }),
                N('div', 'Search and select', { class: 'title' }),
                N('div', 'your company name to login', { class: 'subtitle' }),
                Search.getView()
            ]
        )
    }
}

class EnvWarning extends Viewable {
    constructor() {
        super()
        this.view = N(
            'span',
            [
                N('h1', 'DEV Environment'),
                N('p', 'Expect unavailabilities and potential data loss.')
            ],
            { style: 'text-align: center; background-color: orangered;' }
        )
    }
}

class Footer extends Viewable {
    constructor() {
        super()
        this.view = N('footer', [
            N('div', '', { class: 'links' }),
            N('div', 'Copyright © Catena-X Automotive Network.', { class: 'copy' })
        ])
    }
}

class Main extends Viewable {
    constructor() {
        super()
        this.view = N('main', Selector.getView())
    }
}

let Search
let Selector

window.onload = () => {
    let icon = document.querySelectorAll('link[rel=icon]')[0]
    if (!icon) {
        icon = document.createElement('link')
        icon.rel = 'icon'
        document.head.appendChild(icon)
    }
    icon.href = 'data:image/x-icon;base64,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'
    const CX_PROVIDERS = JSON.parse(
        escapeNames(
            [...document.getElementById('providers').childNodes].map(n => n.data).join('')
        )
    ).slice(0, -1)
    while (document.body.childNodes.length > 0) {
        document.body.removeChild(document.body.firstChild)
    }
    Search = new SearchInput(CX_PROVIDERS)
    Selector = new SelectProvider(CX_PROVIDERS)
    let page = new Page()
    if (window.location.hostname.includes('.dev.')) {
        page.append(new EnvWarning())
    }
    page.append(new Header())
        .append(new Main())
        .append(new Footer())
    Selector.filter(Search.focus().input.value)
}
