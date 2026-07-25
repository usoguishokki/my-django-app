// static/js/parts/search/PartsSearchPage.js

import {
    fetchPartsSearch,
} from '../../api/fetchers.js';

import {
    CustomDropdown,
} from '../../ui/componets/customDropdown/CustomDropdown.js';

import {
    forceHideLoadingScreen,
    initializeLoadingScreen,
    withElementLoading,
} from '../../manager/loadingManager.js';

import {
    bindUIActions,
} from '../../ui/componets/actions/UIActionDispatcher.js';

import {
    clearPartsSearchValidationMessage,
    renderPartsSearchError,
    renderPartsSearchInitial,
    renderPartsSearchResults,
    setPartsSearchValidationMessage,
} from './ui/PartsSearchRenderer.js';


const MAX_SEARCH_VALUE_LENGTH = 100;

const DEFAULT_ERROR_MESSAGE =
    '部品情報を取得できませんでした。'
    + '時間をおいて再度検索してください。';


const SECTION_OPTIONS = Object.freeze([
    Object.freeze({
        value: '',
        label: 'すべて',
    }),
    Object.freeze({
        value: 'molding',
        label: '成形',
    }),
    Object.freeze({
        value: 'press',
        label: 'プレス',
    }),
    Object.freeze({
        value: 'body',
        label: 'ボデー',
    }),
    Object.freeze({
        value: 'painting',
        label: '塗装',
    }),
    Object.freeze({
        value: 'assembly',
        label: '組立て',
    }),
]);


const SECTION_SEARCH_DEFINITION = Object.freeze({
    key: 'section',
    parameterName: 'section',
    label: '係',
});


const TEXT_SEARCH_FIELD_DEFINITIONS = Object.freeze([
    Object.freeze({
        key: 'barcode',
        parameterName: 'barcode',
        inputSelector: '#partsSearchBarcode',
        label: 'バーコード',
    }),
    Object.freeze({
        key: 'rackLevel1',
        parameterName: 'rack_level1',
        inputSelector: '#partsSearchRackLevel1',
        label: '棚番',
    }),
    Object.freeze({
        key: 'partsName',
        parameterName: 'parts_name',
        inputSelector: '#partsSearchPartsName',
        label: '品名',
    }),
    Object.freeze({
        key: 'partsModel',
        parameterName: 'parts_model',
        inputSelector: '#partsSearchPartsModel',
        label: '型式',
    }),
]);


const SEARCH_CRITERIA_DEFINITIONS = Object.freeze([
    SECTION_SEARCH_DEFINITION,
    ...TEXT_SEARCH_FIELD_DEFINITIONS,
]);


const VALID_SECTION_VALUES = new Set(
    SECTION_OPTIONS.map(
        ({
            value,
        }) => value
    )
);


function normalizeText(value) {
    return String(
        value ?? ''
    ).trim();
}


function normalizeSearchCriteria(
    criteria = {},
) {
    return Object.fromEntries(
        SEARCH_CRITERIA_DEFINITIONS.map(
            ({
                key,
                parameterName,
            }) => [
                key,
                normalizeText(
                    criteria?.[key]
                    ?? criteria?.[parameterName]
                ),
            ]
        )
    );
}


function hasAnySearchCondition(
    criteria,
) {
    return SEARCH_CRITERIA_DEFINITIONS.some(
        ({
            key,
        }) => Boolean(
            criteria?.[key]
        )
    );
}


function resolvePayloadErrorMessage(
    payload,
) {
    return (
        normalizeText(
            payload?.error?.message
        )
        || DEFAULT_ERROR_MESSAGE
    );
}


export class PartsSearchPage {
    constructor({
        root,
    }) {
        this.root = root;

        this.form = root?.querySelector(
            '#partsSearchForm'
        ) ?? null;

        this.inputs = Object.fromEntries(
            TEXT_SEARCH_FIELD_DEFINITIONS.map(
                ({
                    key,
                    inputSelector,
                }) => [
                    key,
                    root?.querySelector(
                        inputSelector
                    ) ?? null,
                ]
            )
        );

        this.submitButton = root?.querySelector(
            '#partsSearchSubmitButton'
        ) ?? null;

        this.resultPanel = root?.querySelector(
            '#partsSearchResultPanel'
        ) ?? null;

        this.isSearching = false;
        this.disposeUIActions = null;

        this.handleSearchInput =
            this.handleSearchInput.bind(this);

        this.sectionDropdownRoot =
            root?.querySelector(
                '[data-role="parts-search-section-dropdown"]'
            ) ?? null;

        this.sectionInput =
            root?.querySelector(
                '#partsSearchSection'
            ) ?? null;

        this.sectionTrigger =
            root?.querySelector(
                '#partsSearchSectionTrigger'
            ) ?? null;

        this.sectionDropdown = null;
    }


    async init() {
        if (!this.canInitialize()) {
            throw new Error(
                '部品検索画面の初期化に必要な要素が'
                + '見つかりませんでした。'
            );
        }

        this.initializeSectionDropdown();
        this.bindEvents();

        renderPartsSearchInitial(
            this.root
        );

        const initialCriteria =
            this.readCriteriaFromUrl();

        this.setInputValues(
            initialCriteria
        );

        if (
            !hasAnySearchCondition(
                initialCriteria
            )
        ) {
            this.focusFirstInput();
            return;
        }

        await this.search({
            criteria: initialCriteria,
            updateUrl: false,
        });
    }


    canInitialize() {
        const hasAllTextInputs =
            TEXT_SEARCH_FIELD_DEFINITIONS.every(
                ({
                    key,
                }) => Boolean(
                    this.inputs[key]
                )
            );

        return Boolean(
            this.root
            && this.form
            && this.sectionDropdownRoot
            && this.sectionInput
            && this.sectionTrigger
            && hasAllTextInputs
            && this.submitButton
            && this.resultPanel
        );
    }


    initializeSectionDropdown() {
        this.destroySectionDropdown();

        this.sectionDropdown = new CustomDropdown(
            this.sectionDropdownRoot,
            {
                items: SECTION_OPTIONS,
                value:
                    this.sectionInput?.value
                    ?? '',
                searchable: false,
                placeholder: 'すべて',
                emptyText: '選択できる係がありません',
                autoSelectFirst: false,
                onChange: () => {
                    this.clearValidationError();
                },
            }
        );
    }


    destroySectionDropdown() {
        if (!this.sectionDropdown) {
            return;
        }

        this.sectionDropdown.destroy();
        this.sectionDropdown = null;
    }


    bindEvents() {
        this.disposeUIActions =
            bindUIActions(
                this.root,
                {
                    'search-parts': ({
                        event,
                    } = {}) => {
                        event?.preventDefault();

                        void this.search();
                    },
                }
            );

        this.forEachInput(
            (input) => {
                input.addEventListener(
                    'input',
                    this.handleSearchInput
                );
            }
        );
    }


    destroy() {
        this.disposeUIActions?.();
        this.disposeUIActions = null;

        this.forEachInput(
            (input) => {
                input.removeEventListener(
                    'input',
                    this.handleSearchInput
                );
            }
        );

        this.destroySectionDropdown();
    }


    forEachInput(
        callback,
    ) {
        TEXT_SEARCH_FIELD_DEFINITIONS.forEach(
            ({
                key,
            }) => {
                const input = this.inputs[key];

                if (!input) {
                    return;
                }

                callback(
                    input,
                    key
                );
            }
        );
    }


    handleSearchInput() {
        this.clearValidationError();
    }


    readCriteria() {
        return normalizeSearchCriteria({
            section:
                this.sectionInput?.value,

            ...Object.fromEntries(
                TEXT_SEARCH_FIELD_DEFINITIONS.map(
                    ({
                        key,
                    }) => [
                        key,
                        this.inputs[key]?.value,
                    ]
                )
            ),
        });
    }


    readCriteriaFromUrl() {
        const params = new URLSearchParams(
            window.location.search
        );

        return normalizeSearchCriteria(
            Object.fromEntries(
                SEARCH_CRITERIA_DEFINITIONS.map(
                    ({
                        key,
                        parameterName,
                    }) => [
                        key,
                        params.get(
                            parameterName
                        ),
                    ]
                )
            )
        );
    }


    setInputValues(
        criteria,
    ) {
        const normalizedCriteria =
            normalizeSearchCriteria(
                criteria
            );

        this.sectionDropdown?.setValue(
            normalizedCriteria.section
        );

        this.forEachInput(
            (
                input,
                key,
            ) => {
                input.value =
                    normalizedCriteria[key];
            }
        );
    }


    validateCriteria(
        criteria,
    ) {
        if (
            !VALID_SECTION_VALUES.has(
                criteria.section
            )
        ) {
            return {
                isValid: false,
                fieldName: 'section',
                message:
                    '係の指定が不正です。'
                    + '選択し直してください。',
            };
        }

        if (
            !hasAnySearchCondition(
                criteria
            )
        ) {
            return {
                isValid: false,
                fieldName: '',
                message:
                    '係、バーコード、棚番、品名、型式の'
                    + 'いずれかを指定してください。',
            };
        }

        for (
            const {
                key,
                label,
            }
            of TEXT_SEARCH_FIELD_DEFINITIONS
        ) {
            const value = criteria[key];

            if (
                value.length
                <= MAX_SEARCH_VALUE_LENGTH
            ) {
                continue;
            }

            return {
                isValid: false,
                fieldName: key,
                message:
                    `${label}は`
                    + `${MAX_SEARCH_VALUE_LENGTH}文字以内で`
                    + '入力してください。',
            };
        }

        return {
            isValid: true,
            fieldName: '',
            message: '',
        };
    }


    async search({
        criteria = this.readCriteria(),
        updateUrl = true,
    } = {}) {
        if (this.isSearching) {
            return;
        }

        const normalizedCriteria =
            normalizeSearchCriteria(
                criteria
            );

        const validation =
            this.validateCriteria(
                normalizedCriteria
            );

        if (!validation.isValid) {
            this.showValidationError(
                validation.message,
                {
                    fieldName:
                        validation.fieldName,
                }
            );

            return;
        }

        this.clearValidationError();
        this.setSearchingState(true);

        try {
            const payload =
                await withElementLoading(
                    this.resultPanel,
                    () => fetchPartsSearch(
                        normalizedCriteria
                    ),
                    {
                        title:
                            '部品を検索中',
                        sub:
                            'MARPから部品情報を'
                            + '取得しています',
                        size: 'md',
                        duration: 120,
                    }
                );

            if (!payload?.success) {
                throw new Error(
                    resolvePayloadErrorMessage(
                        payload
                    )
                );
            }

            const responseCriteria =
                this.resolveResponseCriteria(
                    payload,
                    normalizedCriteria
                );

            renderPartsSearchResults(
                this.root,
                {
                    criteria:
                        responseCriteria,

                    items:
                        payload?.items ?? [],

                    summary:
                        payload?.summary ?? {},
                }
            );

            if (updateUrl) {
                this.updateUrlCriteria(
                    responseCriteria
                );
            }

        } catch (error) {
            console.error(
                '[parts search failed]',
                error
            );

            renderPartsSearchError(
                this.root
            );

        } finally {
            this.setSearchingState(false);
        }
    }


    resolveResponseCriteria(
        payload,
        fallbackCriteria,
    ) {
        const responseCriteria =
            normalizeSearchCriteria(
                payload?.query
            );

        if (
            hasAnySearchCondition(
                responseCriteria
            )
        ) {
            return responseCriteria;
        }

        return normalizeSearchCriteria(
            fallbackCriteria
        );
    }


    showValidationError(
        message,
        {
            fieldName = '',
        } = {},
    ) {
        setPartsSearchValidationMessage(
            this.root,
            message
        );

        this.clearInputInvalidStates();

        if (fieldName === 'section') {
            this.sectionTrigger?.setAttribute(
                'aria-invalid',
                'true'
            );

            this.sectionTrigger?.focus();
            return;
        }

        if (
            fieldName
            && this.inputs[fieldName]
        ) {
            this.inputs[fieldName].setAttribute(
                'aria-invalid',
                'true'
            );

            this.inputs[fieldName].focus();
            return;
        }

        /*
         * 全項目未入力の場合は、
         * 検索条件グループ全体が不正なため
         * すべての入力欄を対象とする。
         */

        this.sectionTrigger?.setAttribute(
            'aria-invalid',
            'true'
        );

        this.forEachInput(
            (input) => {
                input.setAttribute(
                    'aria-invalid',
                    'true'
                );
            }
        );

        this.focusFirstInput();
    }


    clearValidationError() {
        clearPartsSearchValidationMessage(
            this.root
        );

        this.clearInputInvalidStates();
    }


    clearInputInvalidStates() {
        this.sectionTrigger?.setAttribute(
            'aria-invalid',
            'false'
        );

        this.forEachInput(
            (input) => {
                input.setAttribute(
                    'aria-invalid',
                    'false'
                );
            }
        );
    }


    focusFirstInput() {
        this.sectionTrigger?.focus();
    }


    setSearchingState(
        isSearching,
    ) {
        this.isSearching = Boolean(
            isSearching
        );

        this.form?.setAttribute(
            'aria-busy',
            this.isSearching
                ? 'true'
                : 'false'
        );

        this.sectionDropdown?.setDisabled(
            this.isSearching
        );

        this.forEachInput(
            (input) => {
                input.readOnly =
                    this.isSearching;
            }
        );

        if (this.submitButton) {
            this.submitButton.disabled =
                this.isSearching;

            this.submitButton.textContent =
                this.isSearching
                    ? '検索中'
                    : '検索';
        }
    }


    updateUrlCriteria(
        criteria,
    ) {
        const normalizedCriteria =
            normalizeSearchCriteria(
                criteria
            );

        const url = new URL(
            window.location.href
        );

        /*
         * 旧形式の検索パラメーターを削除する。
         */
        url.searchParams.delete(
            'keyword'
        );

        SEARCH_CRITERIA_DEFINITIONS.forEach(
            ({
                key,
                parameterName,
            }) => {
                url.searchParams.delete(
                    parameterName
                );

                const value =
                    normalizedCriteria[key];

                if (!value) {
                    return;
                }

                url.searchParams.set(
                    parameterName,
                    value
                );
            }
        );

        window.history.replaceState(
            null,
            '',
            (
                url.pathname
                + url.search
                + url.hash
            )
        );
    }
}


async function initializePartsSearchPage() {
    const root = document.querySelector(
        '[data-parts-search-root]'
    );

    let page = null;

    try {
        if (!root) {
            throw new Error(
                '部品検索画面のルート要素が'
                + '見つかりませんでした。'
            );
        }

        page = new PartsSearchPage({
            root,
        });

        await page.init();

        window.addEventListener(
            'pagehide',
            () => {
                page?.destroy();
            },
            {
                once: true,
            }
        );

    } catch (error) {
        console.error(
            '[parts search initialization failed]',
            error
        );

        if (root) {
            renderPartsSearchError(
                root
            );
        }

        /*
         * 初期化処理でエラーが発生しても、
         * parentGridを非表示のまま残さない。
         */
        forceHideLoadingScreen();

    } finally {
        window.dispatchEvent(
            new CustomEvent(
                'app:ready'
            )
        );
    }
}


function bootstrapPartsSearchPage() {
    initializeLoadingScreen();

    void initializePartsSearchPage();
}


if (
    document.readyState
    === 'loading'
) {
    document.addEventListener(
        'DOMContentLoaded',
        bootstrapPartsSearchPage,
        {
            once: true,
        }
    );
} else {
    bootstrapPartsSearchPage();
}