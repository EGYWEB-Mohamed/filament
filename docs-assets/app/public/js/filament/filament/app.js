;(() => {
    var flushPending = !1,
        flushing = !1,
        queue = []
    function scheduler(callback) {
        queueJob(callback)
    }
    function queueJob(job) {
        queue.includes(job) || queue.push(job), queueFlush()
    }
    function dequeueJob(job) {
        let index = queue.indexOf(job)
        index !== -1 && queue.splice(index, 1)
    }
    function queueFlush() {
        !flushing &&
            !flushPending &&
            ((flushPending = !0), queueMicrotask(flushJobs))
    }
    function flushJobs() {
        ;(flushPending = !1), (flushing = !0)
        for (let i = 0; i < queue.length; i++) queue[i]()
        ;(queue.length = 0), (flushing = !1)
    }
    var reactive,
        effect,
        release,
        raw,
        shouldSchedule = !0
    function disableEffectScheduling(callback) {
        ;(shouldSchedule = !1), callback(), (shouldSchedule = !0)
    }
    function setReactivityEngine(engine) {
        ;(reactive = engine.reactive),
            (release = engine.release),
            (effect = (callback) =>
                engine.effect(callback, {
                    scheduler: (task) => {
                        shouldSchedule ? scheduler(task) : task()
                    },
                })),
            (raw = engine.raw)
    }
    function overrideEffect(override) {
        effect = override
    }
    function elementBoundEffect(el) {
        let cleanup2 = () => {}
        return [
            (callback) => {
                let effectReference = effect(callback)
                return (
                    el._x_effects ||
                        ((el._x_effects = new Set()),
                        (el._x_runEffects = () => {
                            el._x_effects.forEach((i) => i())
                        })),
                    el._x_effects.add(effectReference),
                    (cleanup2 = () => {
                        effectReference !== void 0 &&
                            (el._x_effects.delete(effectReference),
                            release(effectReference))
                    }),
                    effectReference
                )
            },
            () => {
                cleanup2()
            },
        ]
    }
    var onAttributeAddeds = [],
        onElRemoveds = [],
        onElAddeds = []
    function onElAdded(callback) {
        onElAddeds.push(callback)
    }
    function onElRemoved(el, callback) {
        typeof callback == 'function'
            ? (el._x_cleanups || (el._x_cleanups = []),
              el._x_cleanups.push(callback))
            : ((callback = el), onElRemoveds.push(callback))
    }
    function onAttributesAdded(callback) {
        onAttributeAddeds.push(callback)
    }
    function onAttributeRemoved(el, name, callback) {
        el._x_attributeCleanups || (el._x_attributeCleanups = {}),
            el._x_attributeCleanups[name] ||
                (el._x_attributeCleanups[name] = []),
            el._x_attributeCleanups[name].push(callback)
    }
    function cleanupAttributes(el, names) {
        !el._x_attributeCleanups ||
            Object.entries(el._x_attributeCleanups).forEach(([name, value]) => {
                ;(names === void 0 || names.includes(name)) &&
                    (value.forEach((i) => i()),
                    delete el._x_attributeCleanups[name])
            })
    }
    var observer = new MutationObserver(onMutate),
        currentlyObserving = !1
    function startObservingMutations() {
        observer.observe(document, {
            subtree: !0,
            childList: !0,
            attributes: !0,
            attributeOldValue: !0,
        }),
            (currentlyObserving = !0)
    }
    function stopObservingMutations() {
        flushObserver(), observer.disconnect(), (currentlyObserving = !1)
    }
    var recordQueue = [],
        willProcessRecordQueue = !1
    function flushObserver() {
        ;(recordQueue = recordQueue.concat(observer.takeRecords())),
            recordQueue.length &&
                !willProcessRecordQueue &&
                ((willProcessRecordQueue = !0),
                queueMicrotask(() => {
                    processRecordQueue(), (willProcessRecordQueue = !1)
                }))
    }
    function processRecordQueue() {
        onMutate(recordQueue), (recordQueue.length = 0)
    }
    function mutateDom(callback) {
        if (!currentlyObserving) return callback()
        stopObservingMutations()
        let result = callback()
        return startObservingMutations(), result
    }
    var isCollecting = !1,
        deferredMutations = []
    function deferMutations() {
        isCollecting = !0
    }
    function flushAndStopDeferringMutations() {
        ;(isCollecting = !1),
            onMutate(deferredMutations),
            (deferredMutations = [])
    }
    function onMutate(mutations) {
        if (isCollecting) {
            deferredMutations = deferredMutations.concat(mutations)
            return
        }
        let addedNodes = [],
            removedNodes = [],
            addedAttributes = new Map(),
            removedAttributes = new Map()
        for (let i = 0; i < mutations.length; i++)
            if (
                !mutations[i].target._x_ignoreMutationObserver &&
                (mutations[i].type === 'childList' &&
                    (mutations[i].addedNodes.forEach(
                        (node) => node.nodeType === 1 && addedNodes.push(node),
                    ),
                    mutations[i].removedNodes.forEach(
                        (node) =>
                            node.nodeType === 1 && removedNodes.push(node),
                    )),
                mutations[i].type === 'attributes')
            ) {
                let el = mutations[i].target,
                    name = mutations[i].attributeName,
                    oldValue = mutations[i].oldValue,
                    add2 = () => {
                        addedAttributes.has(el) || addedAttributes.set(el, []),
                            addedAttributes
                                .get(el)
                                .push({ name, value: el.getAttribute(name) })
                    },
                    remove = () => {
                        removedAttributes.has(el) ||
                            removedAttributes.set(el, []),
                            removedAttributes.get(el).push(name)
                    }
                el.hasAttribute(name) && oldValue === null
                    ? add2()
                    : el.hasAttribute(name)
                    ? (remove(), add2())
                    : remove()
            }
        removedAttributes.forEach((attrs, el) => {
            cleanupAttributes(el, attrs)
        }),
            addedAttributes.forEach((attrs, el) => {
                onAttributeAddeds.forEach((i) => i(el, attrs))
            })
        for (let node of removedNodes)
            if (
                !addedNodes.includes(node) &&
                (onElRemoveds.forEach((i) => i(node)), node._x_cleanups)
            )
                for (; node._x_cleanups.length; ) node._x_cleanups.pop()()
        addedNodes.forEach((node) => {
            ;(node._x_ignoreSelf = !0), (node._x_ignore = !0)
        })
        for (let node of addedNodes)
            removedNodes.includes(node) ||
                !node.isConnected ||
                (delete node._x_ignoreSelf,
                delete node._x_ignore,
                onElAddeds.forEach((i) => i(node)),
                (node._x_ignore = !0),
                (node._x_ignoreSelf = !0))
        addedNodes.forEach((node) => {
            delete node._x_ignoreSelf, delete node._x_ignore
        }),
            (addedNodes = null),
            (removedNodes = null),
            (addedAttributes = null),
            (removedAttributes = null)
    }
    function scope(node) {
        return mergeProxies(closestDataStack(node))
    }
    function addScopeToNode(node, data2, referenceNode) {
        return (
            (node._x_dataStack = [
                data2,
                ...closestDataStack(referenceNode || node),
            ]),
            () => {
                node._x_dataStack = node._x_dataStack.filter((i) => i !== data2)
            }
        )
    }
    function refreshScope(element, scope2) {
        let existingScope = element._x_dataStack[0]
        Object.entries(scope2).forEach(([key, value]) => {
            existingScope[key] = value
        })
    }
    function closestDataStack(node) {
        return node._x_dataStack
            ? node._x_dataStack
            : typeof ShadowRoot == 'function' && node instanceof ShadowRoot
            ? closestDataStack(node.host)
            : node.parentNode
            ? closestDataStack(node.parentNode)
            : []
    }
    function mergeProxies(objects) {
        let thisProxy = new Proxy(
            {},
            {
                ownKeys: () =>
                    Array.from(new Set(objects.flatMap((i) => Object.keys(i)))),
                has: (target, name) =>
                    objects.some((obj) => obj.hasOwnProperty(name)),
                get: (target, name) =>
                    (objects.find((obj) => {
                        if (obj.hasOwnProperty(name)) {
                            let descriptor = Object.getOwnPropertyDescriptor(
                                obj,
                                name,
                            )
                            if (
                                (descriptor.get &&
                                    descriptor.get._x_alreadyBound) ||
                                (descriptor.set &&
                                    descriptor.set._x_alreadyBound)
                            )
                                return !0
                            if (
                                (descriptor.get || descriptor.set) &&
                                descriptor.enumerable
                            ) {
                                let getter = descriptor.get,
                                    setter = descriptor.set,
                                    property = descriptor
                                ;(getter = getter && getter.bind(thisProxy)),
                                    (setter = setter && setter.bind(thisProxy)),
                                    getter && (getter._x_alreadyBound = !0),
                                    setter && (setter._x_alreadyBound = !0),
                                    Object.defineProperty(obj, name, {
                                        ...property,
                                        get: getter,
                                        set: setter,
                                    })
                            }
                            return !0
                        }
                        return !1
                    }) || {})[name],
                set: (target, name, value) => {
                    let closestObjectWithKey = objects.find((obj) =>
                        obj.hasOwnProperty(name),
                    )
                    return (
                        closestObjectWithKey
                            ? (closestObjectWithKey[name] = value)
                            : (objects[objects.length - 1][name] = value),
                        !0
                    )
                },
            },
        )
        return thisProxy
    }
    function initInterceptors(data2) {
        let isObject2 = (val) =>
                typeof val == 'object' && !Array.isArray(val) && val !== null,
            recurse = (obj, basePath = '') => {
                Object.entries(Object.getOwnPropertyDescriptors(obj)).forEach(
                    ([key, { value, enumerable }]) => {
                        if (enumerable === !1 || value === void 0) return
                        let path = basePath === '' ? key : `${basePath}.${key}`
                        typeof value == 'object' &&
                        value !== null &&
                        value._x_interceptor
                            ? (obj[key] = value.initialize(data2, path, key))
                            : isObject2(value) &&
                              value !== obj &&
                              !(value instanceof Element) &&
                              recurse(value, path)
                    },
                )
            }
        return recurse(data2)
    }
    function interceptor(callback, mutateObj = () => {}) {
        let obj = {
            initialValue: void 0,
            _x_interceptor: !0,
            initialize(data2, path, key) {
                return callback(
                    this.initialValue,
                    () => get(data2, path),
                    (value) => set(data2, path, value),
                    path,
                    key,
                )
            },
        }
        return (
            mutateObj(obj),
            (initialValue) => {
                if (
                    typeof initialValue == 'object' &&
                    initialValue !== null &&
                    initialValue._x_interceptor
                ) {
                    let initialize = obj.initialize.bind(obj)
                    obj.initialize = (data2, path, key) => {
                        let innerValue = initialValue.initialize(
                            data2,
                            path,
                            key,
                        )
                        return (
                            (obj.initialValue = innerValue),
                            initialize(data2, path, key)
                        )
                    }
                } else obj.initialValue = initialValue
                return obj
            }
        )
    }
    function get(obj, path) {
        return path.split('.').reduce((carry, segment) => carry[segment], obj)
    }
    function set(obj, path, value) {
        if (
            (typeof path == 'string' && (path = path.split('.')),
            path.length === 1)
        )
            obj[path[0]] = value
        else {
            if (path.length === 0) throw error
            return (
                obj[path[0]] || (obj[path[0]] = {}),
                set(obj[path[0]], path.slice(1), value)
            )
        }
    }
    var magics = {}
    function magic(name, callback) {
        magics[name] = callback
    }
    function injectMagics(obj, el) {
        return (
            Object.entries(magics).forEach(([name, callback]) => {
                Object.defineProperty(obj, `$${name}`, {
                    get() {
                        let [utilities, cleanup2] = getElementBoundUtilities(el)
                        return (
                            (utilities = { interceptor, ...utilities }),
                            onElRemoved(el, cleanup2),
                            callback(el, utilities)
                        )
                    },
                    enumerable: !1,
                })
            }),
            obj
        )
    }
    function tryCatch(el, expression, callback, ...args) {
        try {
            return callback(...args)
        } catch (e) {
            handleError(e, el, expression)
        }
    }
    function handleError(error2, el, expression = void 0) {
        Object.assign(error2, { el, expression }),
            console.warn(
                `Alpine Expression Error: ${error2.message}

${
    expression
        ? 'Expression: "' +
          expression +
          `"

`
        : ''
}`,
                el,
            ),
            setTimeout(() => {
                throw error2
            }, 0)
    }
    var shouldAutoEvaluateFunctions = !0
    function dontAutoEvaluateFunctions(callback) {
        let cache = shouldAutoEvaluateFunctions
        ;(shouldAutoEvaluateFunctions = !1),
            callback(),
            (shouldAutoEvaluateFunctions = cache)
    }
    function evaluate(el, expression, extras = {}) {
        let result
        return (
            evaluateLater(el, expression)((value) => (result = value), extras),
            result
        )
    }
    function evaluateLater(...args) {
        return theEvaluatorFunction(...args)
    }
    var theEvaluatorFunction = normalEvaluator
    function setEvaluator(newEvaluator) {
        theEvaluatorFunction = newEvaluator
    }
    function normalEvaluator(el, expression) {
        let overriddenMagics = {}
        injectMagics(overriddenMagics, el)
        let dataStack = [overriddenMagics, ...closestDataStack(el)]
        if (typeof expression == 'function')
            return generateEvaluatorFromFunction(dataStack, expression)
        let evaluator = generateEvaluatorFromString(dataStack, expression, el)
        return tryCatch.bind(null, el, expression, evaluator)
    }
    function generateEvaluatorFromFunction(dataStack, func) {
        return (
            receiver = () => {},
            { scope: scope2 = {}, params = [] } = {},
        ) => {
            let result = func.apply(
                mergeProxies([scope2, ...dataStack]),
                params,
            )
            runIfTypeOfFunction(receiver, result)
        }
    }
    var evaluatorMemo = {}
    function generateFunctionFromString(expression, el) {
        if (evaluatorMemo[expression]) return evaluatorMemo[expression]
        let AsyncFunction = Object.getPrototypeOf(
                async function () {},
            ).constructor,
            rightSideSafeExpression =
                /^[\n\s]*if.*\(.*\)/.test(expression) ||
                /^(let|const)\s/.test(expression)
                    ? `(async()=>{ ${expression} })()`
                    : expression,
            func = (() => {
                try {
                    return new AsyncFunction(
                        ['__self', 'scope'],
                        `with (scope) { __self.result = ${rightSideSafeExpression} }; __self.finished = true; return __self.result;`,
                    )
                } catch (error2) {
                    return (
                        handleError(error2, el, expression), Promise.resolve()
                    )
                }
            })()
        return (evaluatorMemo[expression] = func), func
    }
    function generateEvaluatorFromString(dataStack, expression, el) {
        let func = generateFunctionFromString(expression, el)
        return (
            receiver = () => {},
            { scope: scope2 = {}, params = [] } = {},
        ) => {
            ;(func.result = void 0), (func.finished = !1)
            let completeScope = mergeProxies([scope2, ...dataStack])
            if (typeof func == 'function') {
                let promise = func(func, completeScope).catch((error2) =>
                    handleError(error2, el, expression),
                )
                func.finished
                    ? (runIfTypeOfFunction(
                          receiver,
                          func.result,
                          completeScope,
                          params,
                          el,
                      ),
                      (func.result = void 0))
                    : promise
                          .then((result) => {
                              runIfTypeOfFunction(
                                  receiver,
                                  result,
                                  completeScope,
                                  params,
                                  el,
                              )
                          })
                          .catch((error2) =>
                              handleError(error2, el, expression),
                          )
                          .finally(() => (func.result = void 0))
            }
        }
    }
    function runIfTypeOfFunction(receiver, value, scope2, params, el) {
        if (shouldAutoEvaluateFunctions && typeof value == 'function') {
            let result = value.apply(scope2, params)
            result instanceof Promise
                ? result
                      .then((i) =>
                          runIfTypeOfFunction(receiver, i, scope2, params),
                      )
                      .catch((error2) => handleError(error2, el, value))
                : receiver(result)
        } else
            typeof value == 'object' && value instanceof Promise
                ? value.then((i) => receiver(i))
                : receiver(value)
    }
    var prefixAsString = 'x-'
    function prefix(subject = '') {
        return prefixAsString + subject
    }
    function setPrefix(newPrefix) {
        prefixAsString = newPrefix
    }
    var directiveHandlers = {}
    function directive(name, callback) {
        return (
            (directiveHandlers[name] = callback),
            {
                before(directive2) {
                    if (!directiveHandlers[directive2]) {
                        console.warn(
                            'Cannot find directive `${directive}`. `${name}` will use the default order of execution',
                        )
                        return
                    }
                    let pos =
                        directiveOrder.indexOf(directive2) ??
                        directiveOrder.indexOf('DEFAULT')
                    pos >= 0 && directiveOrder.splice(pos, 0, name)
                },
            }
        )
    }
    function directives(el, attributes, originalAttributeOverride) {
        if (((attributes = Array.from(attributes)), el._x_virtualDirectives)) {
            let vAttributes = Object.entries(el._x_virtualDirectives).map(
                    ([name, value]) => ({ name, value }),
                ),
                staticAttributes = attributesOnly(vAttributes)
            ;(vAttributes = vAttributes.map((attribute) =>
                staticAttributes.find((attr) => attr.name === attribute.name)
                    ? {
                          name: `x-bind:${attribute.name}`,
                          value: `"${attribute.value}"`,
                      }
                    : attribute,
            )),
                (attributes = attributes.concat(vAttributes))
        }
        let transformedAttributeMap = {}
        return attributes
            .map(
                toTransformedAttributes(
                    (newName, oldName) =>
                        (transformedAttributeMap[newName] = oldName),
                ),
            )
            .filter(outNonAlpineAttributes)
            .map(
                toParsedDirectives(
                    transformedAttributeMap,
                    originalAttributeOverride,
                ),
            )
            .sort(byPriority)
            .map((directive2) => getDirectiveHandler(el, directive2))
    }
    function attributesOnly(attributes) {
        return Array.from(attributes)
            .map(toTransformedAttributes())
            .filter((attr) => !outNonAlpineAttributes(attr))
    }
    var isDeferringHandlers = !1,
        directiveHandlerStacks = new Map(),
        currentHandlerStackKey = Symbol()
    function deferHandlingDirectives(callback) {
        isDeferringHandlers = !0
        let key = Symbol()
        ;(currentHandlerStackKey = key), directiveHandlerStacks.set(key, [])
        let flushHandlers = () => {
                for (; directiveHandlerStacks.get(key).length; )
                    directiveHandlerStacks.get(key).shift()()
                directiveHandlerStacks.delete(key)
            },
            stopDeferring = () => {
                ;(isDeferringHandlers = !1), flushHandlers()
            }
        callback(flushHandlers), stopDeferring()
    }
    function getElementBoundUtilities(el) {
        let cleanups = [],
            cleanup2 = (callback) => cleanups.push(callback),
            [effect3, cleanupEffect] = elementBoundEffect(el)
        return (
            cleanups.push(cleanupEffect),
            [
                {
                    Alpine: alpine_default,
                    effect: effect3,
                    cleanup: cleanup2,
                    evaluateLater: evaluateLater.bind(evaluateLater, el),
                    evaluate: evaluate.bind(evaluate, el),
                },
                () => cleanups.forEach((i) => i()),
            ]
        )
    }
    function getDirectiveHandler(el, directive2) {
        let noop = () => {},
            handler3 = directiveHandlers[directive2.type] || noop,
            [utilities, cleanup2] = getElementBoundUtilities(el)
        onAttributeRemoved(el, directive2.original, cleanup2)
        let fullHandler = () => {
            el._x_ignore ||
                el._x_ignoreSelf ||
                (handler3.inline && handler3.inline(el, directive2, utilities),
                (handler3 = handler3.bind(handler3, el, directive2, utilities)),
                isDeferringHandlers
                    ? directiveHandlerStacks
                          .get(currentHandlerStackKey)
                          .push(handler3)
                    : handler3())
        }
        return (fullHandler.runCleanups = cleanup2), fullHandler
    }
    var startingWith =
            (subject, replacement) =>
            ({ name, value }) => (
                name.startsWith(subject) &&
                    (name = name.replace(subject, replacement)),
                { name, value }
            ),
        into = (i) => i
    function toTransformedAttributes(callback = () => {}) {
        return ({ name, value }) => {
            let { name: newName, value: newValue } =
                attributeTransformers.reduce(
                    (carry, transform) => transform(carry),
                    { name, value },
                )
            return (
                newName !== name && callback(newName, name),
                { name: newName, value: newValue }
            )
        }
    }
    var attributeTransformers = []
    function mapAttributes(callback) {
        attributeTransformers.push(callback)
    }
    function outNonAlpineAttributes({ name }) {
        return alpineAttributeRegex().test(name)
    }
    var alpineAttributeRegex = () =>
        new RegExp(`^${prefixAsString}([^:^.]+)\\b`)
    function toParsedDirectives(
        transformedAttributeMap,
        originalAttributeOverride,
    ) {
        return ({ name, value }) => {
            let typeMatch = name.match(alpineAttributeRegex()),
                valueMatch = name.match(/:([a-zA-Z0-9\-:]+)/),
                modifiers = name.match(/\.[^.\]]+(?=[^\]]*$)/g) || [],
                original =
                    originalAttributeOverride ||
                    transformedAttributeMap[name] ||
                    name
            return {
                type: typeMatch ? typeMatch[1] : null,
                value: valueMatch ? valueMatch[1] : null,
                modifiers: modifiers.map((i) => i.replace('.', '')),
                expression: value,
                original,
            }
        }
    }
    var DEFAULT = 'DEFAULT',
        directiveOrder = [
            'ignore',
            'ref',
            'data',
            'id',
            'radio',
            'tabs',
            'switch',
            'disclosure',
            'menu',
            'listbox',
            'combobox',
            'bind',
            'init',
            'for',
            'mask',
            'model',
            'modelable',
            'transition',
            'show',
            'if',
            DEFAULT,
            'teleport',
        ]
    function byPriority(a, b) {
        let typeA = directiveOrder.indexOf(a.type) === -1 ? DEFAULT : a.type,
            typeB = directiveOrder.indexOf(b.type) === -1 ? DEFAULT : b.type
        return directiveOrder.indexOf(typeA) - directiveOrder.indexOf(typeB)
    }
    function dispatch(el, name, detail = {}) {
        el.dispatchEvent(
            new CustomEvent(name, {
                detail,
                bubbles: !0,
                composed: !0,
                cancelable: !0,
            }),
        )
    }
    function walk(el, callback) {
        if (typeof ShadowRoot == 'function' && el instanceof ShadowRoot) {
            Array.from(el.children).forEach((el2) => walk(el2, callback))
            return
        }
        let skip = !1
        if ((callback(el, () => (skip = !0)), skip)) return
        let node = el.firstElementChild
        for (; node; )
            walk(node, callback, !1), (node = node.nextElementSibling)
    }
    function warn(message, ...args) {
        console.warn(`Alpine Warning: ${message}`, ...args)
    }
    function start() {
        document.body ||
            warn(
                "Unable to initialize. Trying to load Alpine before `<body>` is available. Did you forget to add `defer` in Alpine's `<script>` tag?",
            ),
            dispatch(document, 'alpine:init'),
            dispatch(document, 'alpine:initializing'),
            startObservingMutations(),
            onElAdded((el) => initTree(el, walk)),
            onElRemoved((el) => destroyTree(el)),
            onAttributesAdded((el, attrs) => {
                directives(el, attrs).forEach((handle) => handle())
            })
        let outNestedComponents = (el) => !closestRoot(el.parentElement, !0)
        Array.from(document.querySelectorAll(allSelectors()))
            .filter(outNestedComponents)
            .forEach((el) => {
                initTree(el)
            }),
            dispatch(document, 'alpine:initialized')
    }
    var rootSelectorCallbacks = [],
        initSelectorCallbacks = []
    function rootSelectors() {
        return rootSelectorCallbacks.map((fn) => fn())
    }
    function allSelectors() {
        return rootSelectorCallbacks
            .concat(initSelectorCallbacks)
            .map((fn) => fn())
    }
    function addRootSelector(selectorCallback) {
        rootSelectorCallbacks.push(selectorCallback)
    }
    function addInitSelector(selectorCallback) {
        initSelectorCallbacks.push(selectorCallback)
    }
    function closestRoot(el, includeInitSelectors = !1) {
        return findClosest(el, (element) => {
            if (
                (includeInitSelectors ? allSelectors() : rootSelectors()).some(
                    (selector) => element.matches(selector),
                )
            )
                return !0
        })
    }
    function findClosest(el, callback) {
        if (!!el) {
            if (callback(el)) return el
            if (
                (el._x_teleportBack && (el = el._x_teleportBack),
                !!el.parentElement)
            )
                return findClosest(el.parentElement, callback)
        }
    }
    function isRoot(el) {
        return rootSelectors().some((selector) => el.matches(selector))
    }
    var initInterceptors2 = []
    function interceptInit(callback) {
        initInterceptors2.push(callback)
    }
    function initTree(el, walker = walk, intercept = () => {}) {
        deferHandlingDirectives(() => {
            walker(el, (el2, skip) => {
                intercept(el2, skip),
                    initInterceptors2.forEach((i) => i(el2, skip)),
                    directives(el2, el2.attributes).forEach((handle) =>
                        handle(),
                    ),
                    el2._x_ignore && skip()
            })
        })
    }
    function destroyTree(root) {
        walk(root, (el) => cleanupAttributes(el))
    }
    var tickStack = [],
        isHolding = !1
    function nextTick(callback = () => {}) {
        return (
            queueMicrotask(() => {
                isHolding ||
                    setTimeout(() => {
                        releaseNextTicks()
                    })
            }),
            new Promise((res) => {
                tickStack.push(() => {
                    callback(), res()
                })
            })
        )
    }
    function releaseNextTicks() {
        for (isHolding = !1; tickStack.length; ) tickStack.shift()()
    }
    function holdNextTicks() {
        isHolding = !0
    }
    function setClasses(el, value) {
        return Array.isArray(value)
            ? setClassesFromString(el, value.join(' '))
            : typeof value == 'object' && value !== null
            ? setClassesFromObject(el, value)
            : typeof value == 'function'
            ? setClasses(el, value())
            : setClassesFromString(el, value)
    }
    function setClassesFromString(el, classString) {
        let split = (classString2) => classString2.split(' ').filter(Boolean),
            missingClasses = (classString2) =>
                classString2
                    .split(' ')
                    .filter((i) => !el.classList.contains(i))
                    .filter(Boolean),
            addClassesAndReturnUndo = (classes) => (
                el.classList.add(...classes),
                () => {
                    el.classList.remove(...classes)
                }
            )
        return (
            (classString =
                classString === !0 ? (classString = '') : classString || ''),
            addClassesAndReturnUndo(missingClasses(classString))
        )
    }
    function setClassesFromObject(el, classObject) {
        let split = (classString) => classString.split(' ').filter(Boolean),
            forAdd = Object.entries(classObject)
                .flatMap(([classString, bool]) =>
                    bool ? split(classString) : !1,
                )
                .filter(Boolean),
            forRemove = Object.entries(classObject)
                .flatMap(([classString, bool]) =>
                    bool ? !1 : split(classString),
                )
                .filter(Boolean),
            added = [],
            removed = []
        return (
            forRemove.forEach((i) => {
                el.classList.contains(i) &&
                    (el.classList.remove(i), removed.push(i))
            }),
            forAdd.forEach((i) => {
                el.classList.contains(i) || (el.classList.add(i), added.push(i))
            }),
            () => {
                removed.forEach((i) => el.classList.add(i)),
                    added.forEach((i) => el.classList.remove(i))
            }
        )
    }
    function setStyles(el, value) {
        return typeof value == 'object' && value !== null
            ? setStylesFromObject(el, value)
            : setStylesFromString(el, value)
    }
    function setStylesFromObject(el, value) {
        let previousStyles = {}
        return (
            Object.entries(value).forEach(([key, value2]) => {
                ;(previousStyles[key] = el.style[key]),
                    key.startsWith('--') || (key = kebabCase(key)),
                    el.style.setProperty(key, value2)
            }),
            setTimeout(() => {
                el.style.length === 0 && el.removeAttribute('style')
            }),
            () => {
                setStyles(el, previousStyles)
            }
        )
    }
    function setStylesFromString(el, value) {
        let cache = el.getAttribute('style', value)
        return (
            el.setAttribute('style', value),
            () => {
                el.setAttribute('style', cache || '')
            }
        )
    }
    function kebabCase(subject) {
        return subject.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
    }
    function once(callback, fallback = () => {}) {
        let called = !1
        return function () {
            called
                ? fallback.apply(this, arguments)
                : ((called = !0), callback.apply(this, arguments))
        }
    }
    directive(
        'transition',
        (el, { value, modifiers, expression }, { evaluate: evaluate2 }) => {
            typeof expression == 'function' &&
                (expression = evaluate2(expression)),
                expression
                    ? registerTransitionsFromClassString(el, expression, value)
                    : registerTransitionsFromHelper(el, modifiers, value)
        },
    )
    function registerTransitionsFromClassString(el, classString, stage) {
        registerTransitionObject(el, setClasses, ''),
            {
                enter: (classes) => {
                    el._x_transition.enter.during = classes
                },
                'enter-start': (classes) => {
                    el._x_transition.enter.start = classes
                },
                'enter-end': (classes) => {
                    el._x_transition.enter.end = classes
                },
                leave: (classes) => {
                    el._x_transition.leave.during = classes
                },
                'leave-start': (classes) => {
                    el._x_transition.leave.start = classes
                },
                'leave-end': (classes) => {
                    el._x_transition.leave.end = classes
                },
            }[stage](classString)
    }
    function registerTransitionsFromHelper(el, modifiers, stage) {
        registerTransitionObject(el, setStyles)
        let doesntSpecify =
                !modifiers.includes('in') &&
                !modifiers.includes('out') &&
                !stage,
            transitioningIn =
                doesntSpecify ||
                modifiers.includes('in') ||
                ['enter'].includes(stage),
            transitioningOut =
                doesntSpecify ||
                modifiers.includes('out') ||
                ['leave'].includes(stage)
        modifiers.includes('in') &&
            !doesntSpecify &&
            (modifiers = modifiers.filter(
                (i, index) => index < modifiers.indexOf('out'),
            )),
            modifiers.includes('out') &&
                !doesntSpecify &&
                (modifiers = modifiers.filter(
                    (i, index) => index > modifiers.indexOf('out'),
                ))
        let wantsAll =
                !modifiers.includes('opacity') && !modifiers.includes('scale'),
            wantsOpacity = wantsAll || modifiers.includes('opacity'),
            wantsScale = wantsAll || modifiers.includes('scale'),
            opacityValue = wantsOpacity ? 0 : 1,
            scaleValue = wantsScale
                ? modifierValue(modifiers, 'scale', 95) / 100
                : 1,
            delay = modifierValue(modifiers, 'delay', 0),
            origin = modifierValue(modifiers, 'origin', 'center'),
            property = 'opacity, transform',
            durationIn = modifierValue(modifiers, 'duration', 150) / 1e3,
            durationOut = modifierValue(modifiers, 'duration', 75) / 1e3,
            easing = 'cubic-bezier(0.4, 0.0, 0.2, 1)'
        transitioningIn &&
            ((el._x_transition.enter.during = {
                transformOrigin: origin,
                transitionDelay: delay,
                transitionProperty: property,
                transitionDuration: `${durationIn}s`,
                transitionTimingFunction: easing,
            }),
            (el._x_transition.enter.start = {
                opacity: opacityValue,
                transform: `scale(${scaleValue})`,
            }),
            (el._x_transition.enter.end = {
                opacity: 1,
                transform: 'scale(1)',
            })),
            transitioningOut &&
                ((el._x_transition.leave.during = {
                    transformOrigin: origin,
                    transitionDelay: delay,
                    transitionProperty: property,
                    transitionDuration: `${durationOut}s`,
                    transitionTimingFunction: easing,
                }),
                (el._x_transition.leave.start = {
                    opacity: 1,
                    transform: 'scale(1)',
                }),
                (el._x_transition.leave.end = {
                    opacity: opacityValue,
                    transform: `scale(${scaleValue})`,
                }))
    }
    function registerTransitionObject(el, setFunction, defaultValue = {}) {
        el._x_transition ||
            (el._x_transition = {
                enter: {
                    during: defaultValue,
                    start: defaultValue,
                    end: defaultValue,
                },
                leave: {
                    during: defaultValue,
                    start: defaultValue,
                    end: defaultValue,
                },
                in(before = () => {}, after = () => {}) {
                    transition(
                        el,
                        setFunction,
                        {
                            during: this.enter.during,
                            start: this.enter.start,
                            end: this.enter.end,
                        },
                        before,
                        after,
                    )
                },
                out(before = () => {}, after = () => {}) {
                    transition(
                        el,
                        setFunction,
                        {
                            during: this.leave.during,
                            start: this.leave.start,
                            end: this.leave.end,
                        },
                        before,
                        after,
                    )
                },
            })
    }
    window.Element.prototype._x_toggleAndCascadeWithTransitions = function (
        el,
        value,
        show,
        hide,
    ) {
        let nextTick2 =
                document.visibilityState === 'visible'
                    ? requestAnimationFrame
                    : setTimeout,
            clickAwayCompatibleShow = () => nextTick2(show)
        if (value) {
            el._x_transition &&
            (el._x_transition.enter || el._x_transition.leave)
                ? el._x_transition.enter &&
                  (Object.entries(el._x_transition.enter.during).length ||
                      Object.entries(el._x_transition.enter.start).length ||
                      Object.entries(el._x_transition.enter.end).length)
                    ? el._x_transition.in(show)
                    : clickAwayCompatibleShow()
                : el._x_transition
                ? el._x_transition.in(show)
                : clickAwayCompatibleShow()
            return
        }
        ;(el._x_hidePromise = el._x_transition
            ? new Promise((resolve, reject) => {
                  el._x_transition.out(
                      () => {},
                      () => resolve(hide),
                  ),
                      el._x_transitioning.beforeCancel(() =>
                          reject({ isFromCancelledTransition: !0 }),
                      )
              })
            : Promise.resolve(hide)),
            queueMicrotask(() => {
                let closest = closestHide(el)
                closest
                    ? (closest._x_hideChildren ||
                          (closest._x_hideChildren = []),
                      closest._x_hideChildren.push(el))
                    : nextTick2(() => {
                          let hideAfterChildren = (el2) => {
                              let carry = Promise.all([
                                  el2._x_hidePromise,
                                  ...(el2._x_hideChildren || []).map(
                                      hideAfterChildren,
                                  ),
                              ]).then(([i]) => i())
                              return (
                                  delete el2._x_hidePromise,
                                  delete el2._x_hideChildren,
                                  carry
                              )
                          }
                          hideAfterChildren(el).catch((e) => {
                              if (!e.isFromCancelledTransition) throw e
                          })
                      })
            })
    }
    function closestHide(el) {
        let parent = el.parentNode
        if (!!parent)
            return parent._x_hidePromise ? parent : closestHide(parent)
    }
    function transition(
        el,
        setFunction,
        { during, start: start2, end } = {},
        before = () => {},
        after = () => {},
    ) {
        if (
            (el._x_transitioning && el._x_transitioning.cancel(),
            Object.keys(during).length === 0 &&
                Object.keys(start2).length === 0 &&
                Object.keys(end).length === 0)
        ) {
            before(), after()
            return
        }
        let undoStart, undoDuring, undoEnd
        performTransition(el, {
            start() {
                undoStart = setFunction(el, start2)
            },
            during() {
                undoDuring = setFunction(el, during)
            },
            before,
            end() {
                undoStart(), (undoEnd = setFunction(el, end))
            },
            after,
            cleanup() {
                undoDuring(), undoEnd()
            },
        })
    }
    function performTransition(el, stages) {
        let interrupted,
            reachedBefore,
            reachedEnd,
            finish = once(() => {
                mutateDom(() => {
                    ;(interrupted = !0),
                        reachedBefore || stages.before(),
                        reachedEnd || (stages.end(), releaseNextTicks()),
                        stages.after(),
                        el.isConnected && stages.cleanup(),
                        delete el._x_transitioning
                })
            })
        ;(el._x_transitioning = {
            beforeCancels: [],
            beforeCancel(callback) {
                this.beforeCancels.push(callback)
            },
            cancel: once(function () {
                for (; this.beforeCancels.length; ) this.beforeCancels.shift()()
                finish()
            }),
            finish,
        }),
            mutateDom(() => {
                stages.start(), stages.during()
            }),
            holdNextTicks(),
            requestAnimationFrame(() => {
                if (interrupted) return
                let duration =
                        Number(
                            getComputedStyle(el)
                                .transitionDuration.replace(/,.*/, '')
                                .replace('s', ''),
                        ) * 1e3,
                    delay =
                        Number(
                            getComputedStyle(el)
                                .transitionDelay.replace(/,.*/, '')
                                .replace('s', ''),
                        ) * 1e3
                duration === 0 &&
                    (duration =
                        Number(
                            getComputedStyle(el).animationDuration.replace(
                                's',
                                '',
                            ),
                        ) * 1e3),
                    mutateDom(() => {
                        stages.before()
                    }),
                    (reachedBefore = !0),
                    requestAnimationFrame(() => {
                        interrupted ||
                            (mutateDom(() => {
                                stages.end()
                            }),
                            releaseNextTicks(),
                            setTimeout(
                                el._x_transitioning.finish,
                                duration + delay,
                            ),
                            (reachedEnd = !0))
                    })
            })
    }
    function modifierValue(modifiers, key, fallback) {
        if (modifiers.indexOf(key) === -1) return fallback
        let rawValue = modifiers[modifiers.indexOf(key) + 1]
        if (!rawValue || (key === 'scale' && isNaN(rawValue))) return fallback
        if (key === 'duration') {
            let match = rawValue.match(/([0-9]+)ms/)
            if (match) return match[1]
        }
        return key === 'origin' &&
            ['top', 'right', 'left', 'center', 'bottom'].includes(
                modifiers[modifiers.indexOf(key) + 2],
            )
            ? [rawValue, modifiers[modifiers.indexOf(key) + 2]].join(' ')
            : rawValue
    }
    var isCloning = !1
    function skipDuringClone(callback, fallback = () => {}) {
        return (...args) => (isCloning ? fallback(...args) : callback(...args))
    }
    function onlyDuringClone(callback) {
        return (...args) => isCloning && callback(...args)
    }
    function clone(oldEl, newEl) {
        newEl._x_dataStack || (newEl._x_dataStack = oldEl._x_dataStack),
            (isCloning = !0),
            dontRegisterReactiveSideEffects(() => {
                cloneTree(newEl)
            }),
            (isCloning = !1)
    }
    function cloneTree(el) {
        let hasRunThroughFirstEl = !1
        initTree(el, (el2, callback) => {
            walk(el2, (el3, skip) => {
                if (hasRunThroughFirstEl && isRoot(el3)) return skip()
                ;(hasRunThroughFirstEl = !0), callback(el3, skip)
            })
        })
    }
    function dontRegisterReactiveSideEffects(callback) {
        let cache = effect
        overrideEffect((callback2, el) => {
            let storedEffect = cache(callback2)
            return release(storedEffect), () => {}
        }),
            callback(),
            overrideEffect(cache)
    }
    function bind(el, name, value, modifiers = []) {
        switch (
            (el._x_bindings || (el._x_bindings = reactive({})),
            (el._x_bindings[name] = value),
            (name = modifiers.includes('camel') ? camelCase(name) : name),
            name)
        ) {
            case 'value':
                bindInputValue(el, value)
                break
            case 'style':
                bindStyles(el, value)
                break
            case 'class':
                bindClasses(el, value)
                break
            default:
                bindAttribute(el, name, value)
                break
        }
    }
    function bindInputValue(el, value) {
        if (el.type === 'radio')
            el.attributes.value === void 0 && (el.value = value),
                window.fromModel &&
                    (el.checked = checkedAttrLooseCompare(el.value, value))
        else if (el.type === 'checkbox')
            Number.isInteger(value)
                ? (el.value = value)
                : !Number.isInteger(value) &&
                  !Array.isArray(value) &&
                  typeof value != 'boolean' &&
                  ![null, void 0].includes(value)
                ? (el.value = String(value))
                : Array.isArray(value)
                ? (el.checked = value.some((val) =>
                      checkedAttrLooseCompare(val, el.value),
                  ))
                : (el.checked = !!value)
        else if (el.tagName === 'SELECT') updateSelect(el, value)
        else {
            if (el.value === value) return
            el.value = value
        }
    }
    function bindClasses(el, value) {
        el._x_undoAddedClasses && el._x_undoAddedClasses(),
            (el._x_undoAddedClasses = setClasses(el, value))
    }
    function bindStyles(el, value) {
        el._x_undoAddedStyles && el._x_undoAddedStyles(),
            (el._x_undoAddedStyles = setStyles(el, value))
    }
    function bindAttribute(el, name, value) {
        ;[null, void 0, !1].includes(value) &&
        attributeShouldntBePreservedIfFalsy(name)
            ? el.removeAttribute(name)
            : (isBooleanAttr(name) && (value = name),
              setIfChanged(el, name, value))
    }
    function setIfChanged(el, attrName, value) {
        el.getAttribute(attrName) != value && el.setAttribute(attrName, value)
    }
    function updateSelect(el, value) {
        let arrayWrappedValue = [].concat(value).map((value2) => value2 + '')
        Array.from(el.options).forEach((option) => {
            option.selected = arrayWrappedValue.includes(option.value)
        })
    }
    function camelCase(subject) {
        return subject
            .toLowerCase()
            .replace(/-(\w)/g, (match, char) => char.toUpperCase())
    }
    function checkedAttrLooseCompare(valueA, valueB) {
        return valueA == valueB
    }
    function isBooleanAttr(attrName) {
        return [
            'disabled',
            'checked',
            'required',
            'readonly',
            'hidden',
            'open',
            'selected',
            'autofocus',
            'itemscope',
            'multiple',
            'novalidate',
            'allowfullscreen',
            'allowpaymentrequest',
            'formnovalidate',
            'autoplay',
            'controls',
            'loop',
            'muted',
            'playsinline',
            'default',
            'ismap',
            'reversed',
            'async',
            'defer',
            'nomodule',
        ].includes(attrName)
    }
    function attributeShouldntBePreservedIfFalsy(name) {
        return ![
            'aria-pressed',
            'aria-checked',
            'aria-expanded',
            'aria-selected',
        ].includes(name)
    }
    function getBinding(el, name, fallback) {
        if (el._x_bindings && el._x_bindings[name] !== void 0)
            return el._x_bindings[name]
        let attr = el.getAttribute(name)
        return attr === null
            ? typeof fallback == 'function'
                ? fallback()
                : fallback
            : attr === ''
            ? !0
            : isBooleanAttr(name)
            ? !![name, 'true'].includes(attr)
            : attr
    }
    function debounce(func, wait) {
        var timeout
        return function () {
            var context = this,
                args = arguments,
                later = function () {
                    ;(timeout = null), func.apply(context, args)
                }
            clearTimeout(timeout), (timeout = setTimeout(later, wait))
        }
    }
    function throttle(func, limit) {
        let inThrottle
        return function () {
            let context = this,
                args = arguments
            inThrottle ||
                (func.apply(context, args),
                (inThrottle = !0),
                setTimeout(() => (inThrottle = !1), limit))
        }
    }
    function plugin(callback) {
        callback(alpine_default)
    }
    var stores = {},
        isReactive = !1
    function store(name, value) {
        if (
            (isReactive || ((stores = reactive(stores)), (isReactive = !0)),
            value === void 0)
        )
            return stores[name]
        ;(stores[name] = value),
            typeof value == 'object' &&
                value !== null &&
                value.hasOwnProperty('init') &&
                typeof value.init == 'function' &&
                stores[name].init(),
            initInterceptors(stores[name])
    }
    function getStores() {
        return stores
    }
    var binds = {}
    function bind2(name, bindings) {
        let getBindings =
            typeof bindings != 'function' ? () => bindings : bindings
        name instanceof Element
            ? applyBindingsObject(name, getBindings())
            : (binds[name] = getBindings)
    }
    function injectBindingProviders(obj) {
        return (
            Object.entries(binds).forEach(([name, callback]) => {
                Object.defineProperty(obj, name, {
                    get() {
                        return (...args) => callback(...args)
                    },
                })
            }),
            obj
        )
    }
    function applyBindingsObject(el, obj, original) {
        let cleanupRunners = []
        for (; cleanupRunners.length; ) cleanupRunners.pop()()
        let attributes = Object.entries(obj).map(([name, value]) => ({
                name,
                value,
            })),
            staticAttributes = attributesOnly(attributes)
        ;(attributes = attributes.map((attribute) =>
            staticAttributes.find((attr) => attr.name === attribute.name)
                ? {
                      name: `x-bind:${attribute.name}`,
                      value: `"${attribute.value}"`,
                  }
                : attribute,
        )),
            directives(el, attributes, original).map((handle) => {
                cleanupRunners.push(handle.runCleanups), handle()
            })
    }
    var datas = {}
    function data(name, callback) {
        datas[name] = callback
    }
    function injectDataProviders(obj, context) {
        return (
            Object.entries(datas).forEach(([name, callback]) => {
                Object.defineProperty(obj, name, {
                    get() {
                        return (...args) => callback.bind(context)(...args)
                    },
                    enumerable: !1,
                })
            }),
            obj
        )
    }
    var Alpine = {
            get reactive() {
                return reactive
            },
            get release() {
                return release
            },
            get effect() {
                return effect
            },
            get raw() {
                return raw
            },
            version: '3.11.1',
            flushAndStopDeferringMutations,
            dontAutoEvaluateFunctions,
            disableEffectScheduling,
            startObservingMutations,
            stopObservingMutations,
            setReactivityEngine,
            closestDataStack,
            skipDuringClone,
            onlyDuringClone,
            addRootSelector,
            addInitSelector,
            addScopeToNode,
            deferMutations,
            mapAttributes,
            evaluateLater,
            interceptInit,
            setEvaluator,
            mergeProxies,
            findClosest,
            closestRoot,
            destroyTree,
            interceptor,
            transition,
            setStyles,
            mutateDom,
            directive,
            throttle,
            debounce,
            evaluate,
            initTree,
            nextTick,
            prefixed: prefix,
            prefix: setPrefix,
            plugin,
            magic,
            store,
            start,
            clone,
            bound: getBinding,
            $data: scope,
            walk,
            data,
            bind: bind2,
        },
        alpine_default = Alpine
    function makeMap(str, expectsLowerCase) {
        let map = Object.create(null),
            list = str.split(',')
        for (let i = 0; i < list.length; i++) map[list[i]] = !0
        return expectsLowerCase
            ? (val) => !!map[val.toLowerCase()]
            : (val) => !!map[val]
    }
    var PatchFlagNames = {
            [1]: 'TEXT',
            [2]: 'CLASS',
            [4]: 'STYLE',
            [8]: 'PROPS',
            [16]: 'FULL_PROPS',
            [32]: 'HYDRATE_EVENTS',
            [64]: 'STABLE_FRAGMENT',
            [128]: 'KEYED_FRAGMENT',
            [256]: 'UNKEYED_FRAGMENT',
            [512]: 'NEED_PATCH',
            [1024]: 'DYNAMIC_SLOTS',
            [2048]: 'DEV_ROOT_FRAGMENT',
            [-1]: 'HOISTED',
            [-2]: 'BAIL',
        },
        slotFlagsText = { [1]: 'STABLE', [2]: 'DYNAMIC', [3]: 'FORWARDED' },
        specialBooleanAttrs =
            'itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly',
        isBooleanAttr2 = makeMap(
            specialBooleanAttrs +
                ',async,autofocus,autoplay,controls,default,defer,disabled,hidden,loop,open,required,reversed,scoped,seamless,checked,muted,multiple,selected',
        ),
        EMPTY_OBJ = Object.freeze({}),
        EMPTY_ARR = Object.freeze([]),
        extend = Object.assign,
        hasOwnProperty = Object.prototype.hasOwnProperty,
        hasOwn = (val, key) => hasOwnProperty.call(val, key),
        isArray = Array.isArray,
        isMap = (val) => toTypeString(val) === '[object Map]',
        isString = (val) => typeof val == 'string',
        isSymbol = (val) => typeof val == 'symbol',
        isObject = (val) => val !== null && typeof val == 'object',
        objectToString = Object.prototype.toString,
        toTypeString = (value) => objectToString.call(value),
        toRawType = (value) => toTypeString(value).slice(8, -1),
        isIntegerKey = (key) =>
            isString(key) &&
            key !== 'NaN' &&
            key[0] !== '-' &&
            '' + parseInt(key, 10) === key,
        cacheStringFunction = (fn) => {
            let cache = Object.create(null)
            return (str) => cache[str] || (cache[str] = fn(str))
        },
        camelizeRE = /-(\w)/g,
        camelize = cacheStringFunction((str) =>
            str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : '')),
        ),
        hyphenateRE = /\B([A-Z])/g,
        hyphenate = cacheStringFunction((str) =>
            str.replace(hyphenateRE, '-$1').toLowerCase(),
        ),
        capitalize = cacheStringFunction(
            (str) => str.charAt(0).toUpperCase() + str.slice(1),
        ),
        toHandlerKey = cacheStringFunction((str) =>
            str ? `on${capitalize(str)}` : '',
        ),
        hasChanged = (value, oldValue) =>
            value !== oldValue && (value === value || oldValue === oldValue),
        targetMap = new WeakMap(),
        effectStack = [],
        activeEffect,
        ITERATE_KEY = Symbol('iterate'),
        MAP_KEY_ITERATE_KEY = Symbol('Map key iterate')
    function isEffect(fn) {
        return fn && fn._isEffect === !0
    }
    function effect2(fn, options = EMPTY_OBJ) {
        isEffect(fn) && (fn = fn.raw)
        let effect3 = createReactiveEffect(fn, options)
        return options.lazy || effect3(), effect3
    }
    function stop(effect3) {
        effect3.active &&
            (cleanup(effect3),
            effect3.options.onStop && effect3.options.onStop(),
            (effect3.active = !1))
    }
    var uid = 0
    function createReactiveEffect(fn, options) {
        let effect3 = function () {
            if (!effect3.active) return fn()
            if (!effectStack.includes(effect3)) {
                cleanup(effect3)
                try {
                    return (
                        enableTracking(),
                        effectStack.push(effect3),
                        (activeEffect = effect3),
                        fn()
                    )
                } finally {
                    effectStack.pop(),
                        resetTracking(),
                        (activeEffect = effectStack[effectStack.length - 1])
                }
            }
        }
        return (
            (effect3.id = uid++),
            (effect3.allowRecurse = !!options.allowRecurse),
            (effect3._isEffect = !0),
            (effect3.active = !0),
            (effect3.raw = fn),
            (effect3.deps = []),
            (effect3.options = options),
            effect3
        )
    }
    function cleanup(effect3) {
        let { deps } = effect3
        if (deps.length) {
            for (let i = 0; i < deps.length; i++) deps[i].delete(effect3)
            deps.length = 0
        }
    }
    var shouldTrack = !0,
        trackStack = []
    function pauseTracking() {
        trackStack.push(shouldTrack), (shouldTrack = !1)
    }
    function enableTracking() {
        trackStack.push(shouldTrack), (shouldTrack = !0)
    }
    function resetTracking() {
        let last = trackStack.pop()
        shouldTrack = last === void 0 ? !0 : last
    }
    function track(target, type, key) {
        if (!shouldTrack || activeEffect === void 0) return
        let depsMap = targetMap.get(target)
        depsMap || targetMap.set(target, (depsMap = new Map()))
        let dep = depsMap.get(key)
        dep || depsMap.set(key, (dep = new Set())),
            dep.has(activeEffect) ||
                (dep.add(activeEffect),
                activeEffect.deps.push(dep),
                activeEffect.options.onTrack &&
                    activeEffect.options.onTrack({
                        effect: activeEffect,
                        target,
                        type,
                        key,
                    }))
    }
    function trigger(target, type, key, newValue, oldValue, oldTarget) {
        let depsMap = targetMap.get(target)
        if (!depsMap) return
        let effects = new Set(),
            add2 = (effectsToAdd) => {
                effectsToAdd &&
                    effectsToAdd.forEach((effect3) => {
                        ;(effect3 !== activeEffect || effect3.allowRecurse) &&
                            effects.add(effect3)
                    })
            }
        if (type === 'clear') depsMap.forEach(add2)
        else if (key === 'length' && isArray(target))
            depsMap.forEach((dep, key2) => {
                ;(key2 === 'length' || key2 >= newValue) && add2(dep)
            })
        else
            switch ((key !== void 0 && add2(depsMap.get(key)), type)) {
                case 'add':
                    isArray(target)
                        ? isIntegerKey(key) && add2(depsMap.get('length'))
                        : (add2(depsMap.get(ITERATE_KEY)),
                          isMap(target) &&
                              add2(depsMap.get(MAP_KEY_ITERATE_KEY)))
                    break
                case 'delete':
                    isArray(target) ||
                        (add2(depsMap.get(ITERATE_KEY)),
                        isMap(target) && add2(depsMap.get(MAP_KEY_ITERATE_KEY)))
                    break
                case 'set':
                    isMap(target) && add2(depsMap.get(ITERATE_KEY))
                    break
            }
        let run = (effect3) => {
            effect3.options.onTrigger &&
                effect3.options.onTrigger({
                    effect: effect3,
                    target,
                    key,
                    type,
                    newValue,
                    oldValue,
                    oldTarget,
                }),
                effect3.options.scheduler
                    ? effect3.options.scheduler(effect3)
                    : effect3()
        }
        effects.forEach(run)
    }
    var isNonTrackableKeys = makeMap('__proto__,__v_isRef,__isVue'),
        builtInSymbols = new Set(
            Object.getOwnPropertyNames(Symbol)
                .map((key) => Symbol[key])
                .filter(isSymbol),
        ),
        get2 = createGetter(),
        shallowGet = createGetter(!1, !0),
        readonlyGet = createGetter(!0),
        shallowReadonlyGet = createGetter(!0, !0),
        arrayInstrumentations = {}
    ;['includes', 'indexOf', 'lastIndexOf'].forEach((key) => {
        let method = Array.prototype[key]
        arrayInstrumentations[key] = function (...args) {
            let arr = toRaw(this)
            for (let i = 0, l = this.length; i < l; i++)
                track(arr, 'get', i + '')
            let res = method.apply(arr, args)
            return res === -1 || res === !1
                ? method.apply(arr, args.map(toRaw))
                : res
        }
    })
    ;['push', 'pop', 'shift', 'unshift', 'splice'].forEach((key) => {
        let method = Array.prototype[key]
        arrayInstrumentations[key] = function (...args) {
            pauseTracking()
            let res = method.apply(this, args)
            return resetTracking(), res
        }
    })
    function createGetter(isReadonly = !1, shallow = !1) {
        return function (target, key, receiver) {
            if (key === '__v_isReactive') return !isReadonly
            if (key === '__v_isReadonly') return isReadonly
            if (
                key === '__v_raw' &&
                receiver ===
                    (isReadonly
                        ? shallow
                            ? shallowReadonlyMap
                            : readonlyMap
                        : shallow
                        ? shallowReactiveMap
                        : reactiveMap
                    ).get(target)
            )
                return target
            let targetIsArray = isArray(target)
            if (
                !isReadonly &&
                targetIsArray &&
                hasOwn(arrayInstrumentations, key)
            )
                return Reflect.get(arrayInstrumentations, key, receiver)
            let res = Reflect.get(target, key, receiver)
            return (isSymbol(key)
                ? builtInSymbols.has(key)
                : isNonTrackableKeys(key)) ||
                (isReadonly || track(target, 'get', key), shallow)
                ? res
                : isRef(res)
                ? !targetIsArray || !isIntegerKey(key)
                    ? res.value
                    : res
                : isObject(res)
                ? isReadonly
                    ? readonly(res)
                    : reactive2(res)
                : res
        }
    }
    var set2 = createSetter(),
        shallowSet = createSetter(!0)
    function createSetter(shallow = !1) {
        return function (target, key, value, receiver) {
            let oldValue = target[key]
            if (
                !shallow &&
                ((value = toRaw(value)),
                (oldValue = toRaw(oldValue)),
                !isArray(target) && isRef(oldValue) && !isRef(value))
            )
                return (oldValue.value = value), !0
            let hadKey =
                    isArray(target) && isIntegerKey(key)
                        ? Number(key) < target.length
                        : hasOwn(target, key),
                result = Reflect.set(target, key, value, receiver)
            return (
                target === toRaw(receiver) &&
                    (hadKey
                        ? hasChanged(value, oldValue) &&
                          trigger(target, 'set', key, value, oldValue)
                        : trigger(target, 'add', key, value)),
                result
            )
        }
    }
    function deleteProperty(target, key) {
        let hadKey = hasOwn(target, key),
            oldValue = target[key],
            result = Reflect.deleteProperty(target, key)
        return (
            result &&
                hadKey &&
                trigger(target, 'delete', key, void 0, oldValue),
            result
        )
    }
    function has(target, key) {
        let result = Reflect.has(target, key)
        return (
            (!isSymbol(key) || !builtInSymbols.has(key)) &&
                track(target, 'has', key),
            result
        )
    }
    function ownKeys(target) {
        return (
            track(target, 'iterate', isArray(target) ? 'length' : ITERATE_KEY),
            Reflect.ownKeys(target)
        )
    }
    var mutableHandlers = {
            get: get2,
            set: set2,
            deleteProperty,
            has,
            ownKeys,
        },
        readonlyHandlers = {
            get: readonlyGet,
            set(target, key) {
                return (
                    console.warn(
                        `Set operation on key "${String(
                            key,
                        )}" failed: target is readonly.`,
                        target,
                    ),
                    !0
                )
            },
            deleteProperty(target, key) {
                return (
                    console.warn(
                        `Delete operation on key "${String(
                            key,
                        )}" failed: target is readonly.`,
                        target,
                    ),
                    !0
                )
            },
        },
        shallowReactiveHandlers = extend({}, mutableHandlers, {
            get: shallowGet,
            set: shallowSet,
        }),
        shallowReadonlyHandlers = extend({}, readonlyHandlers, {
            get: shallowReadonlyGet,
        }),
        toReactive = (value) => (isObject(value) ? reactive2(value) : value),
        toReadonly = (value) => (isObject(value) ? readonly(value) : value),
        toShallow = (value) => value,
        getProto = (v) => Reflect.getPrototypeOf(v)
    function get$1(target, key, isReadonly = !1, isShallow = !1) {
        target = target.__v_raw
        let rawTarget = toRaw(target),
            rawKey = toRaw(key)
        key !== rawKey && !isReadonly && track(rawTarget, 'get', key),
            !isReadonly && track(rawTarget, 'get', rawKey)
        let { has: has2 } = getProto(rawTarget),
            wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive
        if (has2.call(rawTarget, key)) return wrap(target.get(key))
        if (has2.call(rawTarget, rawKey)) return wrap(target.get(rawKey))
        target !== rawTarget && target.get(key)
    }
    function has$1(key, isReadonly = !1) {
        let target = this.__v_raw,
            rawTarget = toRaw(target),
            rawKey = toRaw(key)
        return (
            key !== rawKey && !isReadonly && track(rawTarget, 'has', key),
            !isReadonly && track(rawTarget, 'has', rawKey),
            key === rawKey
                ? target.has(key)
                : target.has(key) || target.has(rawKey)
        )
    }
    function size(target, isReadonly = !1) {
        return (
            (target = target.__v_raw),
            !isReadonly && track(toRaw(target), 'iterate', ITERATE_KEY),
            Reflect.get(target, 'size', target)
        )
    }
    function add(value) {
        value = toRaw(value)
        let target = toRaw(this)
        return (
            getProto(target).has.call(target, value) ||
                (target.add(value), trigger(target, 'add', value, value)),
            this
        )
    }
    function set$1(key, value) {
        value = toRaw(value)
        let target = toRaw(this),
            { has: has2, get: get3 } = getProto(target),
            hadKey = has2.call(target, key)
        hadKey
            ? checkIdentityKeys(target, has2, key)
            : ((key = toRaw(key)), (hadKey = has2.call(target, key)))
        let oldValue = get3.call(target, key)
        return (
            target.set(key, value),
            hadKey
                ? hasChanged(value, oldValue) &&
                  trigger(target, 'set', key, value, oldValue)
                : trigger(target, 'add', key, value),
            this
        )
    }
    function deleteEntry(key) {
        let target = toRaw(this),
            { has: has2, get: get3 } = getProto(target),
            hadKey = has2.call(target, key)
        hadKey
            ? checkIdentityKeys(target, has2, key)
            : ((key = toRaw(key)), (hadKey = has2.call(target, key)))
        let oldValue = get3 ? get3.call(target, key) : void 0,
            result = target.delete(key)
        return (
            hadKey && trigger(target, 'delete', key, void 0, oldValue), result
        )
    }
    function clear() {
        let target = toRaw(this),
            hadItems = target.size !== 0,
            oldTarget = isMap(target) ? new Map(target) : new Set(target),
            result = target.clear()
        return (
            hadItems && trigger(target, 'clear', void 0, void 0, oldTarget),
            result
        )
    }
    function createForEach(isReadonly, isShallow) {
        return function (callback, thisArg) {
            let observed = this,
                target = observed.__v_raw,
                rawTarget = toRaw(target),
                wrap = isShallow
                    ? toShallow
                    : isReadonly
                    ? toReadonly
                    : toReactive
            return (
                !isReadonly && track(rawTarget, 'iterate', ITERATE_KEY),
                target.forEach((value, key) =>
                    callback.call(thisArg, wrap(value), wrap(key), observed),
                )
            )
        }
    }
    function createIterableMethod(method, isReadonly, isShallow) {
        return function (...args) {
            let target = this.__v_raw,
                rawTarget = toRaw(target),
                targetIsMap = isMap(rawTarget),
                isPair =
                    method === 'entries' ||
                    (method === Symbol.iterator && targetIsMap),
                isKeyOnly = method === 'keys' && targetIsMap,
                innerIterator = target[method](...args),
                wrap = isShallow
                    ? toShallow
                    : isReadonly
                    ? toReadonly
                    : toReactive
            return (
                !isReadonly &&
                    track(
                        rawTarget,
                        'iterate',
                        isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY,
                    ),
                {
                    next() {
                        let { value, done } = innerIterator.next()
                        return done
                            ? { value, done }
                            : {
                                  value: isPair
                                      ? [wrap(value[0]), wrap(value[1])]
                                      : wrap(value),
                                  done,
                              }
                    },
                    [Symbol.iterator]() {
                        return this
                    },
                }
            )
        }
    }
    function createReadonlyMethod(type) {
        return function (...args) {
            {
                let key = args[0] ? `on key "${args[0]}" ` : ''
                console.warn(
                    `${capitalize(
                        type,
                    )} operation ${key}failed: target is readonly.`,
                    toRaw(this),
                )
            }
            return type === 'delete' ? !1 : this
        }
    }
    var mutableInstrumentations = {
            get(key) {
                return get$1(this, key)
            },
            get size() {
                return size(this)
            },
            has: has$1,
            add,
            set: set$1,
            delete: deleteEntry,
            clear,
            forEach: createForEach(!1, !1),
        },
        shallowInstrumentations = {
            get(key) {
                return get$1(this, key, !1, !0)
            },
            get size() {
                return size(this)
            },
            has: has$1,
            add,
            set: set$1,
            delete: deleteEntry,
            clear,
            forEach: createForEach(!1, !0),
        },
        readonlyInstrumentations = {
            get(key) {
                return get$1(this, key, !0)
            },
            get size() {
                return size(this, !0)
            },
            has(key) {
                return has$1.call(this, key, !0)
            },
            add: createReadonlyMethod('add'),
            set: createReadonlyMethod('set'),
            delete: createReadonlyMethod('delete'),
            clear: createReadonlyMethod('clear'),
            forEach: createForEach(!0, !1),
        },
        shallowReadonlyInstrumentations = {
            get(key) {
                return get$1(this, key, !0, !0)
            },
            get size() {
                return size(this, !0)
            },
            has(key) {
                return has$1.call(this, key, !0)
            },
            add: createReadonlyMethod('add'),
            set: createReadonlyMethod('set'),
            delete: createReadonlyMethod('delete'),
            clear: createReadonlyMethod('clear'),
            forEach: createForEach(!0, !0),
        },
        iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator]
    iteratorMethods.forEach((method) => {
        ;(mutableInstrumentations[method] = createIterableMethod(
            method,
            !1,
            !1,
        )),
            (readonlyInstrumentations[method] = createIterableMethod(
                method,
                !0,
                !1,
            )),
            (shallowInstrumentations[method] = createIterableMethod(
                method,
                !1,
                !0,
            )),
            (shallowReadonlyInstrumentations[method] = createIterableMethod(
                method,
                !0,
                !0,
            ))
    })
    function createInstrumentationGetter(isReadonly, shallow) {
        let instrumentations = shallow
            ? isReadonly
                ? shallowReadonlyInstrumentations
                : shallowInstrumentations
            : isReadonly
            ? readonlyInstrumentations
            : mutableInstrumentations
        return (target, key, receiver) =>
            key === '__v_isReactive'
                ? !isReadonly
                : key === '__v_isReadonly'
                ? isReadonly
                : key === '__v_raw'
                ? target
                : Reflect.get(
                      hasOwn(instrumentations, key) && key in target
                          ? instrumentations
                          : target,
                      key,
                      receiver,
                  )
    }
    var mutableCollectionHandlers = {
            get: createInstrumentationGetter(!1, !1),
        },
        shallowCollectionHandlers = {
            get: createInstrumentationGetter(!1, !0),
        },
        readonlyCollectionHandlers = {
            get: createInstrumentationGetter(!0, !1),
        },
        shallowReadonlyCollectionHandlers = {
            get: createInstrumentationGetter(!0, !0),
        }
    function checkIdentityKeys(target, has2, key) {
        let rawKey = toRaw(key)
        if (rawKey !== key && has2.call(target, rawKey)) {
            let type = toRawType(target)
            console.warn(
                `Reactive ${type} contains both the raw and reactive versions of the same object${
                    type === 'Map' ? ' as keys' : ''
                }, which can lead to inconsistencies. Avoid differentiating between the raw and reactive versions of an object and only use the reactive version if possible.`,
            )
        }
    }
    var reactiveMap = new WeakMap(),
        shallowReactiveMap = new WeakMap(),
        readonlyMap = new WeakMap(),
        shallowReadonlyMap = new WeakMap()
    function targetTypeMap(rawType) {
        switch (rawType) {
            case 'Object':
            case 'Array':
                return 1
            case 'Map':
            case 'Set':
            case 'WeakMap':
            case 'WeakSet':
                return 2
            default:
                return 0
        }
    }
    function getTargetType(value) {
        return value.__v_skip || !Object.isExtensible(value)
            ? 0
            : targetTypeMap(toRawType(value))
    }
    function reactive2(target) {
        return target && target.__v_isReadonly
            ? target
            : createReactiveObject(
                  target,
                  !1,
                  mutableHandlers,
                  mutableCollectionHandlers,
                  reactiveMap,
              )
    }
    function readonly(target) {
        return createReactiveObject(
            target,
            !0,
            readonlyHandlers,
            readonlyCollectionHandlers,
            readonlyMap,
        )
    }
    function createReactiveObject(
        target,
        isReadonly,
        baseHandlers,
        collectionHandlers,
        proxyMap,
    ) {
        if (!isObject(target))
            return (
                console.warn(
                    `value cannot be made reactive: ${String(target)}`,
                ),
                target
            )
        if (target.__v_raw && !(isReadonly && target.__v_isReactive))
            return target
        let existingProxy = proxyMap.get(target)
        if (existingProxy) return existingProxy
        let targetType = getTargetType(target)
        if (targetType === 0) return target
        let proxy = new Proxy(
            target,
            targetType === 2 ? collectionHandlers : baseHandlers,
        )
        return proxyMap.set(target, proxy), proxy
    }
    function toRaw(observed) {
        return (observed && toRaw(observed.__v_raw)) || observed
    }
    function isRef(r) {
        return Boolean(r && r.__v_isRef === !0)
    }
    magic('nextTick', () => nextTick)
    magic('dispatch', (el) => dispatch.bind(dispatch, el))
    magic(
        'watch',
        (el, { evaluateLater: evaluateLater2, effect: effect3 }) =>
            (key, callback) => {
                let evaluate2 = evaluateLater2(key),
                    firstTime = !0,
                    oldValue,
                    effectReference = effect3(() =>
                        evaluate2((value) => {
                            JSON.stringify(value),
                                firstTime
                                    ? (oldValue = value)
                                    : queueMicrotask(() => {
                                          callback(value, oldValue),
                                              (oldValue = value)
                                      }),
                                (firstTime = !1)
                        }),
                    )
                el._x_effects.delete(effectReference)
            },
    )
    magic('store', getStores)
    magic('data', (el) => scope(el))
    magic('root', (el) => closestRoot(el))
    magic(
        'refs',
        (el) => (
            el._x_refs_proxy ||
                (el._x_refs_proxy = mergeProxies(getArrayOfRefObject(el))),
            el._x_refs_proxy
        ),
    )
    function getArrayOfRefObject(el) {
        let refObjects = [],
            currentEl = el
        for (; currentEl; )
            currentEl._x_refs && refObjects.push(currentEl._x_refs),
                (currentEl = currentEl.parentNode)
        return refObjects
    }
    var globalIdMemo = {}
    function findAndIncrementId(name) {
        return (
            globalIdMemo[name] || (globalIdMemo[name] = 0), ++globalIdMemo[name]
        )
    }
    function closestIdRoot(el, name) {
        return findClosest(el, (element) => {
            if (element._x_ids && element._x_ids[name]) return !0
        })
    }
    function setIdRoot(el, name) {
        el._x_ids || (el._x_ids = {}),
            el._x_ids[name] || (el._x_ids[name] = findAndIncrementId(name))
    }
    magic('id', (el) => (name, key = null) => {
        let root = closestIdRoot(el, name),
            id = root ? root._x_ids[name] : findAndIncrementId(name)
        return key ? `${name}-${id}-${key}` : `${name}-${id}`
    })
    magic('el', (el) => el)
    warnMissingPluginMagic('Focus', 'focus', 'focus')
    warnMissingPluginMagic('Persist', 'persist', 'persist')
    function warnMissingPluginMagic(name, magicName, slug) {
        magic(magicName, (el) =>
            warn(
                `You can't use [$${directiveName}] without first installing the "${name}" plugin here: https://alpinejs.dev/plugins/${slug}`,
                el,
            ),
        )
    }
    function entangle(
        { get: outerGet, set: outerSet },
        { get: innerGet, set: innerSet },
    ) {
        let firstRun = !0,
            outerHash,
            innerHash,
            outerHashLatest,
            innerHashLatest,
            reference = effect(() => {
                let outer, inner
                firstRun
                    ? ((outer = outerGet()),
                      innerSet(outer),
                      (inner = innerGet()),
                      (firstRun = !1))
                    : ((outer = outerGet()),
                      (inner = innerGet()),
                      (outerHashLatest = JSON.stringify(outer)),
                      (innerHashLatest = JSON.stringify(inner)),
                      outerHashLatest !== outerHash
                          ? ((inner = innerGet()),
                            innerSet(outer),
                            (inner = outer))
                          : (outerSet(inner), (outer = inner))),
                    (outerHash = JSON.stringify(outer)),
                    (innerHash = JSON.stringify(inner))
            })
        return () => {
            release(reference)
        }
    }
    directive(
        'modelable',
        (
            el,
            { expression },
            {
                effect: effect3,
                evaluateLater: evaluateLater2,
                cleanup: cleanup2,
            },
        ) => {
            let func = evaluateLater2(expression),
                innerGet = () => {
                    let result
                    return func((i) => (result = i)), result
                },
                evaluateInnerSet = evaluateLater2(
                    `${expression} = __placeholder`,
                ),
                innerSet = (val) =>
                    evaluateInnerSet(() => {}, {
                        scope: { __placeholder: val },
                    }),
                initialValue = innerGet()
            innerSet(initialValue),
                queueMicrotask(() => {
                    if (!el._x_model) return
                    el._x_removeModelListeners.default()
                    let outerGet = el._x_model.get,
                        outerSet = el._x_model.set,
                        releaseEntanglement = entangle(
                            {
                                get() {
                                    return outerGet()
                                },
                                set(value) {
                                    outerSet(value)
                                },
                            },
                            {
                                get() {
                                    return innerGet()
                                },
                                set(value) {
                                    innerSet(value)
                                },
                            },
                        )
                    cleanup2(releaseEntanglement)
                })
        },
    )
    var teleportContainerDuringClone = document.createElement('div')
    directive(
        'teleport',
        (el, { modifiers, expression }, { cleanup: cleanup2 }) => {
            el.tagName.toLowerCase() !== 'template' &&
                warn('x-teleport can only be used on a <template> tag', el)
            let target = skipDuringClone(
                () => document.querySelector(expression),
                () => teleportContainerDuringClone,
            )()
            target ||
                warn(
                    `Cannot find x-teleport element for selector: "${expression}"`,
                )
            let clone2 = el.content.cloneNode(!0).firstElementChild
            ;(el._x_teleport = clone2),
                (clone2._x_teleportBack = el),
                el._x_forwardEvents &&
                    el._x_forwardEvents.forEach((eventName) => {
                        clone2.addEventListener(eventName, (e) => {
                            e.stopPropagation(),
                                el.dispatchEvent(new e.constructor(e.type, e))
                        })
                    }),
                addScopeToNode(clone2, {}, el),
                mutateDom(() => {
                    modifiers.includes('prepend')
                        ? target.parentNode.insertBefore(clone2, target)
                        : modifiers.includes('append')
                        ? target.parentNode.insertBefore(
                              clone2,
                              target.nextSibling,
                          )
                        : target.appendChild(clone2),
                        initTree(clone2),
                        (clone2._x_ignore = !0)
                }),
                cleanup2(() => clone2.remove())
        },
    )
    var handler = () => {}
    handler.inline = (el, { modifiers }, { cleanup: cleanup2 }) => {
        modifiers.includes('self')
            ? (el._x_ignoreSelf = !0)
            : (el._x_ignore = !0),
            cleanup2(() => {
                modifiers.includes('self')
                    ? delete el._x_ignoreSelf
                    : delete el._x_ignore
            })
    }
    directive('ignore', handler)
    directive('effect', (el, { expression }, { effect: effect3 }) =>
        effect3(evaluateLater(el, expression)),
    )
    function on(el, event, modifiers, callback) {
        let listenerTarget = el,
            handler3 = (e) => callback(e),
            options = {},
            wrapHandler = (callback2, wrapper) => (e) => wrapper(callback2, e)
        if (
            (modifiers.includes('dot') && (event = dotSyntax(event)),
            modifiers.includes('camel') && (event = camelCase2(event)),
            modifiers.includes('passive') && (options.passive = !0),
            modifiers.includes('capture') && (options.capture = !0),
            modifiers.includes('window') && (listenerTarget = window),
            modifiers.includes('document') && (listenerTarget = document),
            modifiers.includes('prevent') &&
                (handler3 = wrapHandler(handler3, (next, e) => {
                    e.preventDefault(), next(e)
                })),
            modifiers.includes('stop') &&
                (handler3 = wrapHandler(handler3, (next, e) => {
                    e.stopPropagation(), next(e)
                })),
            modifiers.includes('self') &&
                (handler3 = wrapHandler(handler3, (next, e) => {
                    e.target === el && next(e)
                })),
            (modifiers.includes('away') || modifiers.includes('outside')) &&
                ((listenerTarget = document),
                (handler3 = wrapHandler(handler3, (next, e) => {
                    el.contains(e.target) ||
                        (e.target.isConnected !== !1 &&
                            ((el.offsetWidth < 1 && el.offsetHeight < 1) ||
                                (el._x_isShown !== !1 && next(e))))
                }))),
            modifiers.includes('once') &&
                (handler3 = wrapHandler(handler3, (next, e) => {
                    next(e),
                        listenerTarget.removeEventListener(
                            event,
                            handler3,
                            options,
                        )
                })),
            (handler3 = wrapHandler(handler3, (next, e) => {
                ;(isKeyEvent(event) &&
                    isListeningForASpecificKeyThatHasntBeenPressed(
                        e,
                        modifiers,
                    )) ||
                    next(e)
            })),
            modifiers.includes('debounce'))
        ) {
            let nextModifier =
                    modifiers[modifiers.indexOf('debounce') + 1] ||
                    'invalid-wait',
                wait = isNumeric(nextModifier.split('ms')[0])
                    ? Number(nextModifier.split('ms')[0])
                    : 250
            handler3 = debounce(handler3, wait)
        }
        if (modifiers.includes('throttle')) {
            let nextModifier =
                    modifiers[modifiers.indexOf('throttle') + 1] ||
                    'invalid-wait',
                wait = isNumeric(nextModifier.split('ms')[0])
                    ? Number(nextModifier.split('ms')[0])
                    : 250
            handler3 = throttle(handler3, wait)
        }
        return (
            listenerTarget.addEventListener(event, handler3, options),
            () => {
                listenerTarget.removeEventListener(event, handler3, options)
            }
        )
    }
    function dotSyntax(subject) {
        return subject.replace(/-/g, '.')
    }
    function camelCase2(subject) {
        return subject
            .toLowerCase()
            .replace(/-(\w)/g, (match, char) => char.toUpperCase())
    }
    function isNumeric(subject) {
        return !Array.isArray(subject) && !isNaN(subject)
    }
    function kebabCase2(subject) {
        return [' ', '_'].includes(subject)
            ? subject
            : subject
                  .replace(/([a-z])([A-Z])/g, '$1-$2')
                  .replace(/[_\s]/, '-')
                  .toLowerCase()
    }
    function isKeyEvent(event) {
        return ['keydown', 'keyup'].includes(event)
    }
    function isListeningForASpecificKeyThatHasntBeenPressed(e, modifiers) {
        let keyModifiers = modifiers.filter(
            (i) =>
                !['window', 'document', 'prevent', 'stop', 'once'].includes(i),
        )
        if (keyModifiers.includes('debounce')) {
            let debounceIndex = keyModifiers.indexOf('debounce')
            keyModifiers.splice(
                debounceIndex,
                isNumeric(
                    (keyModifiers[debounceIndex + 1] || 'invalid-wait').split(
                        'ms',
                    )[0],
                )
                    ? 2
                    : 1,
            )
        }
        if (keyModifiers.includes('throttle')) {
            let debounceIndex = keyModifiers.indexOf('throttle')
            keyModifiers.splice(
                debounceIndex,
                isNumeric(
                    (keyModifiers[debounceIndex + 1] || 'invalid-wait').split(
                        'ms',
                    )[0],
                )
                    ? 2
                    : 1,
            )
        }
        if (
            keyModifiers.length === 0 ||
            (keyModifiers.length === 1 &&
                keyToModifiers(e.key).includes(keyModifiers[0]))
        )
            return !1
        let selectedSystemKeyModifiers = [
            'ctrl',
            'shift',
            'alt',
            'meta',
            'cmd',
            'super',
        ].filter((modifier) => keyModifiers.includes(modifier))
        return (
            (keyModifiers = keyModifiers.filter(
                (i) => !selectedSystemKeyModifiers.includes(i),
            )),
            !(
                selectedSystemKeyModifiers.length > 0 &&
                selectedSystemKeyModifiers.filter(
                    (modifier) => (
                        (modifier === 'cmd' || modifier === 'super') &&
                            (modifier = 'meta'),
                        e[`${modifier}Key`]
                    ),
                ).length === selectedSystemKeyModifiers.length &&
                keyToModifiers(e.key).includes(keyModifiers[0])
            )
        )
    }
    function keyToModifiers(key) {
        if (!key) return []
        key = kebabCase2(key)
        let modifierToKeyMap = {
            ctrl: 'control',
            slash: '/',
            space: ' ',
            spacebar: ' ',
            cmd: 'meta',
            esc: 'escape',
            up: 'arrow-up',
            down: 'arrow-down',
            left: 'arrow-left',
            right: 'arrow-right',
            period: '.',
            equal: '=',
            minus: '-',
            underscore: '_',
        }
        return (
            (modifierToKeyMap[key] = key),
            Object.keys(modifierToKeyMap)
                .map((modifier) => {
                    if (modifierToKeyMap[modifier] === key) return modifier
                })
                .filter((modifier) => modifier)
        )
    }
    directive(
        'model',
        (
            el,
            { modifiers, expression },
            { effect: effect3, cleanup: cleanup2 },
        ) => {
            let scopeTarget = el
            modifiers.includes('parent') && (scopeTarget = el.parentNode)
            let evaluateGet = evaluateLater(scopeTarget, expression),
                evaluateSet
            typeof expression == 'string'
                ? (evaluateSet = evaluateLater(
                      scopeTarget,
                      `${expression} = __placeholder`,
                  ))
                : typeof expression == 'function' &&
                  typeof expression() == 'string'
                ? (evaluateSet = evaluateLater(
                      scopeTarget,
                      `${expression()} = __placeholder`,
                  ))
                : (evaluateSet = () => {})
            let getValue = () => {
                    let result
                    return (
                        evaluateGet((value) => (result = value)),
                        isGetterSetter(result) ? result.get() : result
                    )
                },
                setValue = (value) => {
                    let result
                    evaluateGet((value2) => (result = value2)),
                        isGetterSetter(result)
                            ? result.set(value)
                            : evaluateSet(() => {}, {
                                  scope: { __placeholder: value },
                              })
                }
            typeof expression == 'string' &&
                el.type === 'radio' &&
                mutateDom(() => {
                    el.hasAttribute('name') ||
                        el.setAttribute('name', expression)
                })
            var event =
                el.tagName.toLowerCase() === 'select' ||
                ['checkbox', 'radio'].includes(el.type) ||
                modifiers.includes('lazy')
                    ? 'change'
                    : 'input'
            let removeListener = on(el, event, modifiers, (e) => {
                setValue(getInputValue(el, modifiers, e, getValue()))
            })
            if (
                (el._x_removeModelListeners ||
                    (el._x_removeModelListeners = {}),
                (el._x_removeModelListeners.default = removeListener),
                cleanup2(() => el._x_removeModelListeners.default()),
                el.form)
            ) {
                let removeResetListener = on(el.form, 'reset', [], (e) => {
                    nextTick(() => el._x_model && el._x_model.set(el.value))
                })
                cleanup2(() => removeResetListener())
            }
            ;(el._x_model = {
                get() {
                    return getValue()
                },
                set(value) {
                    setValue(value)
                },
            }),
                (el._x_forceModelUpdate = (value) => {
                    ;(value = value === void 0 ? getValue() : value),
                        value === void 0 &&
                            typeof expression == 'string' &&
                            expression.match(/\./) &&
                            (value = ''),
                        (window.fromModel = !0),
                        mutateDom(() => bind(el, 'value', value)),
                        delete window.fromModel
                }),
                effect3(() => {
                    let value = getValue()
                    ;(modifiers.includes('unintrusive') &&
                        document.activeElement.isSameNode(el)) ||
                        el._x_forceModelUpdate(value)
                })
        },
    )
    function getInputValue(el, modifiers, event, currentValue) {
        return mutateDom(() => {
            if (event instanceof CustomEvent && event.detail !== void 0)
                return typeof event.detail != 'undefined'
                    ? event.detail
                    : event.target.value
            if (el.type === 'checkbox')
                if (Array.isArray(currentValue)) {
                    let newValue = modifiers.includes('number')
                        ? safeParseNumber(event.target.value)
                        : event.target.value
                    return event.target.checked
                        ? currentValue.concat([newValue])
                        : currentValue.filter(
                              (el2) => !checkedAttrLooseCompare2(el2, newValue),
                          )
                } else return event.target.checked
            else {
                if (el.tagName.toLowerCase() === 'select' && el.multiple)
                    return modifiers.includes('number')
                        ? Array.from(event.target.selectedOptions).map(
                              (option) => {
                                  let rawValue = option.value || option.text
                                  return safeParseNumber(rawValue)
                              },
                          )
                        : Array.from(event.target.selectedOptions).map(
                              (option) => option.value || option.text,
                          )
                {
                    let rawValue = event.target.value
                    return modifiers.includes('number')
                        ? safeParseNumber(rawValue)
                        : modifiers.includes('trim')
                        ? rawValue.trim()
                        : rawValue
                }
            }
        })
    }
    function safeParseNumber(rawValue) {
        let number = rawValue ? parseFloat(rawValue) : null
        return isNumeric2(number) ? number : rawValue
    }
    function checkedAttrLooseCompare2(valueA, valueB) {
        return valueA == valueB
    }
    function isNumeric2(subject) {
        return !Array.isArray(subject) && !isNaN(subject)
    }
    function isGetterSetter(value) {
        return (
            value !== null &&
            typeof value == 'object' &&
            typeof value.get == 'function' &&
            typeof value.set == 'function'
        )
    }
    directive('cloak', (el) =>
        queueMicrotask(() =>
            mutateDom(() => el.removeAttribute(prefix('cloak'))),
        ),
    )
    addInitSelector(() => `[${prefix('init')}]`)
    directive(
        'init',
        skipDuringClone((el, { expression }, { evaluate: evaluate2 }) =>
            typeof expression == 'string'
                ? !!expression.trim() && evaluate2(expression, {}, !1)
                : evaluate2(expression, {}, !1),
        ),
    )
    directive(
        'text',
        (
            el,
            { expression },
            { effect: effect3, evaluateLater: evaluateLater2 },
        ) => {
            let evaluate2 = evaluateLater2(expression)
            effect3(() => {
                evaluate2((value) => {
                    mutateDom(() => {
                        el.textContent = value
                    })
                })
            })
        },
    )
    directive(
        'html',
        (
            el,
            { expression },
            { effect: effect3, evaluateLater: evaluateLater2 },
        ) => {
            let evaluate2 = evaluateLater2(expression)
            effect3(() => {
                evaluate2((value) => {
                    mutateDom(() => {
                        ;(el.innerHTML = value),
                            (el._x_ignoreSelf = !0),
                            initTree(el),
                            delete el._x_ignoreSelf
                    })
                })
            })
        },
    )
    mapAttributes(startingWith(':', into(prefix('bind:'))))
    directive(
        'bind',
        (
            el,
            { value, modifiers, expression, original },
            { effect: effect3 },
        ) => {
            if (!value) {
                let bindingProviders = {}
                injectBindingProviders(bindingProviders),
                    evaluateLater(el, expression)(
                        (bindings) => {
                            applyBindingsObject(el, bindings, original)
                        },
                        { scope: bindingProviders },
                    )
                return
            }
            if (value === 'key') return storeKeyForXFor(el, expression)
            let evaluate2 = evaluateLater(el, expression)
            effect3(() =>
                evaluate2((result) => {
                    result === void 0 &&
                        typeof expression == 'string' &&
                        expression.match(/\./) &&
                        (result = ''),
                        mutateDom(() => bind(el, value, result, modifiers))
                }),
            )
        },
    )
    function storeKeyForXFor(el, expression) {
        el._x_keyExpression = expression
    }
    addRootSelector(() => `[${prefix('data')}]`)
    directive(
        'data',
        skipDuringClone((el, { expression }, { cleanup: cleanup2 }) => {
            expression = expression === '' ? '{}' : expression
            let magicContext = {}
            injectMagics(magicContext, el)
            let dataProviderContext = {}
            injectDataProviders(dataProviderContext, magicContext)
            let data2 = evaluate(el, expression, { scope: dataProviderContext })
            data2 === void 0 && (data2 = {}), injectMagics(data2, el)
            let reactiveData = reactive(data2)
            initInterceptors(reactiveData)
            let undo = addScopeToNode(el, reactiveData)
            reactiveData.init && evaluate(el, reactiveData.init),
                cleanup2(() => {
                    reactiveData.destroy && evaluate(el, reactiveData.destroy),
                        undo()
                })
        }),
    )
    directive('show', (el, { modifiers, expression }, { effect: effect3 }) => {
        let evaluate2 = evaluateLater(el, expression)
        el._x_doHide ||
            (el._x_doHide = () => {
                mutateDom(() => {
                    el.style.setProperty(
                        'display',
                        'none',
                        modifiers.includes('important') ? 'important' : void 0,
                    )
                })
            }),
            el._x_doShow ||
                (el._x_doShow = () => {
                    mutateDom(() => {
                        el.style.length === 1 && el.style.display === 'none'
                            ? el.removeAttribute('style')
                            : el.style.removeProperty('display')
                    })
                })
        let hide = () => {
                el._x_doHide(), (el._x_isShown = !1)
            },
            show = () => {
                el._x_doShow(), (el._x_isShown = !0)
            },
            clickAwayCompatibleShow = () => setTimeout(show),
            toggle = once(
                (value) => (value ? show() : hide()),
                (value) => {
                    typeof el._x_toggleAndCascadeWithTransitions == 'function'
                        ? el._x_toggleAndCascadeWithTransitions(
                              el,
                              value,
                              show,
                              hide,
                          )
                        : value
                        ? clickAwayCompatibleShow()
                        : hide()
                },
            ),
            oldValue,
            firstTime = !0
        effect3(() =>
            evaluate2((value) => {
                ;(!firstTime && value === oldValue) ||
                    (modifiers.includes('immediate') &&
                        (value ? clickAwayCompatibleShow() : hide()),
                    toggle(value),
                    (oldValue = value),
                    (firstTime = !1))
            }),
        )
    })
    directive(
        'for',
        (el, { expression }, { effect: effect3, cleanup: cleanup2 }) => {
            let iteratorNames = parseForExpression(expression),
                evaluateItems = evaluateLater(el, iteratorNames.items),
                evaluateKey = evaluateLater(el, el._x_keyExpression || 'index')
            ;(el._x_prevKeys = []),
                (el._x_lookup = {}),
                effect3(() =>
                    loop(el, iteratorNames, evaluateItems, evaluateKey),
                ),
                cleanup2(() => {
                    Object.values(el._x_lookup).forEach((el2) => el2.remove()),
                        delete el._x_prevKeys,
                        delete el._x_lookup
                })
        },
    )
    function loop(el, iteratorNames, evaluateItems, evaluateKey) {
        let isObject2 = (i) => typeof i == 'object' && !Array.isArray(i),
            templateEl = el
        evaluateItems((items) => {
            isNumeric3(items) &&
                items >= 0 &&
                (items = Array.from(Array(items).keys(), (i) => i + 1)),
                items === void 0 && (items = [])
            let lookup = el._x_lookup,
                prevKeys = el._x_prevKeys,
                scopes = [],
                keys = []
            if (isObject2(items))
                items = Object.entries(items).map(([key, value]) => {
                    let scope2 = getIterationScopeVariables(
                        iteratorNames,
                        value,
                        key,
                        items,
                    )
                    evaluateKey((value2) => keys.push(value2), {
                        scope: { index: key, ...scope2 },
                    }),
                        scopes.push(scope2)
                })
            else
                for (let i = 0; i < items.length; i++) {
                    let scope2 = getIterationScopeVariables(
                        iteratorNames,
                        items[i],
                        i,
                        items,
                    )
                    evaluateKey((value) => keys.push(value), {
                        scope: { index: i, ...scope2 },
                    }),
                        scopes.push(scope2)
                }
            let adds = [],
                moves = [],
                removes = [],
                sames = []
            for (let i = 0; i < prevKeys.length; i++) {
                let key = prevKeys[i]
                keys.indexOf(key) === -1 && removes.push(key)
            }
            prevKeys = prevKeys.filter((key) => !removes.includes(key))
            let lastKey = 'template'
            for (let i = 0; i < keys.length; i++) {
                let key = keys[i],
                    prevIndex = prevKeys.indexOf(key)
                if (prevIndex === -1)
                    prevKeys.splice(i, 0, key), adds.push([lastKey, i])
                else if (prevIndex !== i) {
                    let keyInSpot = prevKeys.splice(i, 1)[0],
                        keyForSpot = prevKeys.splice(prevIndex - 1, 1)[0]
                    prevKeys.splice(i, 0, keyForSpot),
                        prevKeys.splice(prevIndex, 0, keyInSpot),
                        moves.push([keyInSpot, keyForSpot])
                } else sames.push(key)
                lastKey = key
            }
            for (let i = 0; i < removes.length; i++) {
                let key = removes[i]
                lookup[key]._x_effects &&
                    lookup[key]._x_effects.forEach(dequeueJob),
                    lookup[key].remove(),
                    (lookup[key] = null),
                    delete lookup[key]
            }
            for (let i = 0; i < moves.length; i++) {
                let [keyInSpot, keyForSpot] = moves[i],
                    elInSpot = lookup[keyInSpot],
                    elForSpot = lookup[keyForSpot],
                    marker = document.createElement('div')
                mutateDom(() => {
                    elForSpot.after(marker),
                        elInSpot.after(elForSpot),
                        elForSpot._x_currentIfEl &&
                            elForSpot.after(elForSpot._x_currentIfEl),
                        marker.before(elInSpot),
                        elInSpot._x_currentIfEl &&
                            elInSpot.after(elInSpot._x_currentIfEl),
                        marker.remove()
                }),
                    refreshScope(elForSpot, scopes[keys.indexOf(keyForSpot)])
            }
            for (let i = 0; i < adds.length; i++) {
                let [lastKey2, index] = adds[i],
                    lastEl =
                        lastKey2 === 'template' ? templateEl : lookup[lastKey2]
                lastEl._x_currentIfEl && (lastEl = lastEl._x_currentIfEl)
                let scope2 = scopes[index],
                    key = keys[index],
                    clone2 = document.importNode(
                        templateEl.content,
                        !0,
                    ).firstElementChild
                addScopeToNode(clone2, reactive(scope2), templateEl),
                    mutateDom(() => {
                        lastEl.after(clone2), initTree(clone2)
                    }),
                    typeof key == 'object' &&
                        warn(
                            'x-for key cannot be an object, it must be a string or an integer',
                            templateEl,
                        ),
                    (lookup[key] = clone2)
            }
            for (let i = 0; i < sames.length; i++)
                refreshScope(lookup[sames[i]], scopes[keys.indexOf(sames[i])])
            templateEl._x_prevKeys = keys
        })
    }
    function parseForExpression(expression) {
        let forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/,
            stripParensRE = /^\s*\(|\)\s*$/g,
            forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/,
            inMatch = expression.match(forAliasRE)
        if (!inMatch) return
        let res = {}
        res.items = inMatch[2].trim()
        let item = inMatch[1].replace(stripParensRE, '').trim(),
            iteratorMatch = item.match(forIteratorRE)
        return (
            iteratorMatch
                ? ((res.item = item.replace(forIteratorRE, '').trim()),
                  (res.index = iteratorMatch[1].trim()),
                  iteratorMatch[2] &&
                      (res.collection = iteratorMatch[2].trim()))
                : (res.item = item),
            res
        )
    }
    function getIterationScopeVariables(iteratorNames, item, index, items) {
        let scopeVariables = {}
        return (
            /^\[.*\]$/.test(iteratorNames.item) && Array.isArray(item)
                ? iteratorNames.item
                      .replace('[', '')
                      .replace(']', '')
                      .split(',')
                      .map((i) => i.trim())
                      .forEach((name, i) => {
                          scopeVariables[name] = item[i]
                      })
                : /^\{.*\}$/.test(iteratorNames.item) &&
                  !Array.isArray(item) &&
                  typeof item == 'object'
                ? iteratorNames.item
                      .replace('{', '')
                      .replace('}', '')
                      .split(',')
                      .map((i) => i.trim())
                      .forEach((name) => {
                          scopeVariables[name] = item[name]
                      })
                : (scopeVariables[iteratorNames.item] = item),
            iteratorNames.index &&
                (scopeVariables[iteratorNames.index] = index),
            iteratorNames.collection &&
                (scopeVariables[iteratorNames.collection] = items),
            scopeVariables
        )
    }
    function isNumeric3(subject) {
        return !Array.isArray(subject) && !isNaN(subject)
    }
    function handler2() {}
    handler2.inline = (el, { expression }, { cleanup: cleanup2 }) => {
        let root = closestRoot(el)
        root._x_refs || (root._x_refs = {}),
            (root._x_refs[expression] = el),
            cleanup2(() => delete root._x_refs[expression])
    }
    directive('ref', handler2)
    directive(
        'if',
        (el, { expression }, { effect: effect3, cleanup: cleanup2 }) => {
            let evaluate2 = evaluateLater(el, expression),
                show = () => {
                    if (el._x_currentIfEl) return el._x_currentIfEl
                    let clone2 = el.content.cloneNode(!0).firstElementChild
                    return (
                        addScopeToNode(clone2, {}, el),
                        mutateDom(() => {
                            el.after(clone2), initTree(clone2)
                        }),
                        (el._x_currentIfEl = clone2),
                        (el._x_undoIf = () => {
                            walk(clone2, (node) => {
                                node._x_effects &&
                                    node._x_effects.forEach(dequeueJob)
                            }),
                                clone2.remove(),
                                delete el._x_currentIfEl
                        }),
                        clone2
                    )
                },
                hide = () => {
                    !el._x_undoIf || (el._x_undoIf(), delete el._x_undoIf)
                }
            effect3(() =>
                evaluate2((value) => {
                    value ? show() : hide()
                }),
            ),
                cleanup2(() => el._x_undoIf && el._x_undoIf())
        },
    )
    directive('id', (el, { expression }, { evaluate: evaluate2 }) => {
        evaluate2(expression).forEach((name) => setIdRoot(el, name))
    })
    mapAttributes(startingWith('@', into(prefix('on:'))))
    directive(
        'on',
        skipDuringClone(
            (el, { value, modifiers, expression }, { cleanup: cleanup2 }) => {
                let evaluate2 = expression
                    ? evaluateLater(el, expression)
                    : () => {}
                el.tagName.toLowerCase() === 'template' &&
                    (el._x_forwardEvents || (el._x_forwardEvents = []),
                    el._x_forwardEvents.includes(value) ||
                        el._x_forwardEvents.push(value))
                let removeListener = on(el, value, modifiers, (e) => {
                    evaluate2(() => {}, { scope: { $event: e }, params: [e] })
                })
                cleanup2(() => removeListener())
            },
        ),
    )
    warnMissingPluginDirective('Collapse', 'collapse', 'collapse')
    warnMissingPluginDirective('Intersect', 'intersect', 'intersect')
    warnMissingPluginDirective('Focus', 'trap', 'focus')
    warnMissingPluginDirective('Mask', 'mask', 'mask')
    function warnMissingPluginDirective(name, directiveName2, slug) {
        directive(directiveName2, (el) =>
            warn(
                `You can't use [x-${directiveName2}] without first installing the "${name}" plugin here: https://alpinejs.dev/plugins/${slug}`,
                el,
            ),
        )
    }
    alpine_default.setEvaluator(normalEvaluator)
    alpine_default.setReactivityEngine({
        reactive: reactive2,
        effect: effect2,
        release: stop,
        raw: toRaw,
    })
    var src_default = alpine_default,
        module_default = src_default
    var __create = Object.create,
        __defProp = Object.defineProperty,
        __getProtoOf = Object.getPrototypeOf,
        __hasOwnProp = Object.prototype.hasOwnProperty,
        __getOwnPropNames = Object.getOwnPropertyNames,
        __getOwnPropDesc = Object.getOwnPropertyDescriptor,
        __markAsModule = (target) =>
            __defProp(target, '__esModule', { value: !0 }),
        __commonJS = (callback, module) => () => (
            module ||
                ((module = { exports: {} }), callback(module.exports, module)),
            module.exports
        ),
        __exportStar = (target, module, desc) => {
            if (
                (module && typeof module == 'object') ||
                typeof module == 'function'
            )
                for (let key of __getOwnPropNames(module))
                    !__hasOwnProp.call(target, key) &&
                        key !== 'default' &&
                        __defProp(target, key, {
                            get: () => module[key],
                            enumerable:
                                !(desc = __getOwnPropDesc(module, key)) ||
                                desc.enumerable,
                        })
            return target
        },
        __toModule = (module) =>
            __exportStar(
                __markAsModule(
                    __defProp(
                        module != null ? __create(__getProtoOf(module)) : {},
                        'default',
                        module && module.__esModule && 'default' in module
                            ? { get: () => module.default, enumerable: !0 }
                            : { value: module, enumerable: !0 },
                    ),
                ),
                module,
            ),
        require_mousetrap = __commonJS((exports, module) => {
            ;(function (window2, document2, undefined2) {
                if (!window2) return
                for (
                    var _MAP = {
                            8: 'backspace',
                            9: 'tab',
                            13: 'enter',
                            16: 'shift',
                            17: 'ctrl',
                            18: 'alt',
                            20: 'capslock',
                            27: 'esc',
                            32: 'space',
                            33: 'pageup',
                            34: 'pagedown',
                            35: 'end',
                            36: 'home',
                            37: 'left',
                            38: 'up',
                            39: 'right',
                            40: 'down',
                            45: 'ins',
                            46: 'del',
                            91: 'meta',
                            93: 'meta',
                            224: 'meta',
                        },
                        _KEYCODE_MAP = {
                            106: '*',
                            107: '+',
                            109: '-',
                            110: '.',
                            111: '/',
                            186: ';',
                            187: '=',
                            188: ',',
                            189: '-',
                            190: '.',
                            191: '/',
                            192: '`',
                            219: '[',
                            220: '\\',
                            221: ']',
                            222: "'",
                        },
                        _SHIFT_MAP = {
                            '~': '`',
                            '!': '1',
                            '@': '2',
                            '#': '3',
                            $: '4',
                            '%': '5',
                            '^': '6',
                            '&': '7',
                            '*': '8',
                            '(': '9',
                            ')': '0',
                            _: '-',
                            '+': '=',
                            ':': ';',
                            '"': "'",
                            '<': ',',
                            '>': '.',
                            '?': '/',
                            '|': '\\',
                        },
                        _SPECIAL_ALIASES = {
                            option: 'alt',
                            command: 'meta',
                            return: 'enter',
                            escape: 'esc',
                            plus: '+',
                            mod: /Mac|iPod|iPhone|iPad/.test(navigator.platform)
                                ? 'meta'
                                : 'ctrl',
                        },
                        _REVERSE_MAP,
                        i = 1;
                    i < 20;
                    ++i
                )
                    _MAP[111 + i] = 'f' + i
                for (i = 0; i <= 9; ++i) _MAP[i + 96] = i.toString()
                function _addEvent(object, type, callback) {
                    if (object.addEventListener) {
                        object.addEventListener(type, callback, !1)
                        return
                    }
                    object.attachEvent('on' + type, callback)
                }
                function _characterFromEvent(e) {
                    if (e.type == 'keypress') {
                        var character = String.fromCharCode(e.which)
                        return (
                            e.shiftKey || (character = character.toLowerCase()),
                            character
                        )
                    }
                    return _MAP[e.which]
                        ? _MAP[e.which]
                        : _KEYCODE_MAP[e.which]
                        ? _KEYCODE_MAP[e.which]
                        : String.fromCharCode(e.which).toLowerCase()
                }
                function _modifiersMatch(modifiers1, modifiers2) {
                    return (
                        modifiers1.sort().join(',') ===
                        modifiers2.sort().join(',')
                    )
                }
                function _eventModifiers(e) {
                    var modifiers = []
                    return (
                        e.shiftKey && modifiers.push('shift'),
                        e.altKey && modifiers.push('alt'),
                        e.ctrlKey && modifiers.push('ctrl'),
                        e.metaKey && modifiers.push('meta'),
                        modifiers
                    )
                }
                function _preventDefault(e) {
                    if (e.preventDefault) {
                        e.preventDefault()
                        return
                    }
                    e.returnValue = !1
                }
                function _stopPropagation(e) {
                    if (e.stopPropagation) {
                        e.stopPropagation()
                        return
                    }
                    e.cancelBubble = !0
                }
                function _isModifier(key) {
                    return (
                        key == 'shift' ||
                        key == 'ctrl' ||
                        key == 'alt' ||
                        key == 'meta'
                    )
                }
                function _getReverseMap() {
                    if (!_REVERSE_MAP) {
                        _REVERSE_MAP = {}
                        for (var key in _MAP)
                            (key > 95 && key < 112) ||
                                (_MAP.hasOwnProperty(key) &&
                                    (_REVERSE_MAP[_MAP[key]] = key))
                    }
                    return _REVERSE_MAP
                }
                function _pickBestAction(key, modifiers, action) {
                    return (
                        action ||
                            (action = _getReverseMap()[key]
                                ? 'keydown'
                                : 'keypress'),
                        action == 'keypress' &&
                            modifiers.length &&
                            (action = 'keydown'),
                        action
                    )
                }
                function _keysFromString(combination) {
                    return combination === '+'
                        ? ['+']
                        : ((combination = combination.replace(
                              /\+{2}/g,
                              '+plus',
                          )),
                          combination.split('+'))
                }
                function _getKeyInfo(combination, action) {
                    var keys,
                        key,
                        i2,
                        modifiers = []
                    for (
                        keys = _keysFromString(combination), i2 = 0;
                        i2 < keys.length;
                        ++i2
                    )
                        (key = keys[i2]),
                            _SPECIAL_ALIASES[key] &&
                                (key = _SPECIAL_ALIASES[key]),
                            action &&
                                action != 'keypress' &&
                                _SHIFT_MAP[key] &&
                                ((key = _SHIFT_MAP[key]),
                                modifiers.push('shift')),
                            _isModifier(key) && modifiers.push(key)
                    return (
                        (action = _pickBestAction(key, modifiers, action)),
                        { key, modifiers, action }
                    )
                }
                function _belongsTo(element, ancestor) {
                    return element === null || element === document2
                        ? !1
                        : element === ancestor
                        ? !0
                        : _belongsTo(element.parentNode, ancestor)
                }
                function Mousetrap3(targetElement) {
                    var self = this
                    if (
                        ((targetElement = targetElement || document2),
                        !(self instanceof Mousetrap3))
                    )
                        return new Mousetrap3(targetElement)
                    ;(self.target = targetElement),
                        (self._callbacks = {}),
                        (self._directMap = {})
                    var _sequenceLevels = {},
                        _resetTimer,
                        _ignoreNextKeyup = !1,
                        _ignoreNextKeypress = !1,
                        _nextExpectedAction = !1
                    function _resetSequences(doNotReset) {
                        doNotReset = doNotReset || {}
                        var activeSequences = !1,
                            key
                        for (key in _sequenceLevels) {
                            if (doNotReset[key]) {
                                activeSequences = !0
                                continue
                            }
                            _sequenceLevels[key] = 0
                        }
                        activeSequences || (_nextExpectedAction = !1)
                    }
                    function _getMatches(
                        character,
                        modifiers,
                        e,
                        sequenceName,
                        combination,
                        level,
                    ) {
                        var i2,
                            callback,
                            matches = [],
                            action = e.type
                        if (!self._callbacks[character]) return []
                        for (
                            action == 'keyup' &&
                                _isModifier(character) &&
                                (modifiers = [character]),
                                i2 = 0;
                            i2 < self._callbacks[character].length;
                            ++i2
                        )
                            if (
                                ((callback = self._callbacks[character][i2]),
                                !(
                                    !sequenceName &&
                                    callback.seq &&
                                    _sequenceLevels[callback.seq] !=
                                        callback.level
                                ) &&
                                    action == callback.action &&
                                    ((action == 'keypress' &&
                                        !e.metaKey &&
                                        !e.ctrlKey) ||
                                        _modifiersMatch(
                                            modifiers,
                                            callback.modifiers,
                                        )))
                            ) {
                                var deleteCombo =
                                        !sequenceName &&
                                        callback.combo == combination,
                                    deleteSequence =
                                        sequenceName &&
                                        callback.seq == sequenceName &&
                                        callback.level == level
                                ;(deleteCombo || deleteSequence) &&
                                    self._callbacks[character].splice(i2, 1),
                                    matches.push(callback)
                            }
                        return matches
                    }
                    function _fireCallback(callback, e, combo, sequence) {
                        self.stopCallback(
                            e,
                            e.target || e.srcElement,
                            combo,
                            sequence,
                        ) ||
                            (callback(e, combo) === !1 &&
                                (_preventDefault(e), _stopPropagation(e)))
                    }
                    self._handleKey = function (character, modifiers, e) {
                        var callbacks = _getMatches(character, modifiers, e),
                            i2,
                            doNotReset = {},
                            maxLevel = 0,
                            processedSequenceCallback = !1
                        for (i2 = 0; i2 < callbacks.length; ++i2)
                            callbacks[i2].seq &&
                                (maxLevel = Math.max(
                                    maxLevel,
                                    callbacks[i2].level,
                                ))
                        for (i2 = 0; i2 < callbacks.length; ++i2) {
                            if (callbacks[i2].seq) {
                                if (callbacks[i2].level != maxLevel) continue
                                ;(processedSequenceCallback = !0),
                                    (doNotReset[callbacks[i2].seq] = 1),
                                    _fireCallback(
                                        callbacks[i2].callback,
                                        e,
                                        callbacks[i2].combo,
                                        callbacks[i2].seq,
                                    )
                                continue
                            }
                            processedSequenceCallback ||
                                _fireCallback(
                                    callbacks[i2].callback,
                                    e,
                                    callbacks[i2].combo,
                                )
                        }
                        var ignoreThisKeypress =
                            e.type == 'keypress' && _ignoreNextKeypress
                        e.type == _nextExpectedAction &&
                            !_isModifier(character) &&
                            !ignoreThisKeypress &&
                            _resetSequences(doNotReset),
                            (_ignoreNextKeypress =
                                processedSequenceCallback &&
                                e.type == 'keydown')
                    }
                    function _handleKeyEvent(e) {
                        typeof e.which != 'number' && (e.which = e.keyCode)
                        var character = _characterFromEvent(e)
                        if (!!character) {
                            if (
                                e.type == 'keyup' &&
                                _ignoreNextKeyup === character
                            ) {
                                _ignoreNextKeyup = !1
                                return
                            }
                            self.handleKey(character, _eventModifiers(e), e)
                        }
                    }
                    function _resetSequenceTimer() {
                        clearTimeout(_resetTimer),
                            (_resetTimer = setTimeout(_resetSequences, 1e3))
                    }
                    function _bindSequence(combo, keys, callback, action) {
                        _sequenceLevels[combo] = 0
                        function _increaseSequence(nextAction) {
                            return function () {
                                ;(_nextExpectedAction = nextAction),
                                    ++_sequenceLevels[combo],
                                    _resetSequenceTimer()
                            }
                        }
                        function _callbackAndReset(e) {
                            _fireCallback(callback, e, combo),
                                action !== 'keyup' &&
                                    (_ignoreNextKeyup = _characterFromEvent(e)),
                                setTimeout(_resetSequences, 10)
                        }
                        for (var i2 = 0; i2 < keys.length; ++i2) {
                            var isFinal = i2 + 1 === keys.length,
                                wrappedCallback = isFinal
                                    ? _callbackAndReset
                                    : _increaseSequence(
                                          action ||
                                              _getKeyInfo(keys[i2 + 1]).action,
                                      )
                            _bindSingle(
                                keys[i2],
                                wrappedCallback,
                                action,
                                combo,
                                i2,
                            )
                        }
                    }
                    function _bindSingle(
                        combination,
                        callback,
                        action,
                        sequenceName,
                        level,
                    ) {
                        ;(self._directMap[combination + ':' + action] =
                            callback),
                            (combination = combination.replace(/\s+/g, ' '))
                        var sequence = combination.split(' '),
                            info
                        if (sequence.length > 1) {
                            _bindSequence(
                                combination,
                                sequence,
                                callback,
                                action,
                            )
                            return
                        }
                        ;(info = _getKeyInfo(combination, action)),
                            (self._callbacks[info.key] =
                                self._callbacks[info.key] || []),
                            _getMatches(
                                info.key,
                                info.modifiers,
                                { type: info.action },
                                sequenceName,
                                combination,
                                level,
                            ),
                            self._callbacks[info.key][
                                sequenceName ? 'unshift' : 'push'
                            ]({
                                callback,
                                modifiers: info.modifiers,
                                action: info.action,
                                seq: sequenceName,
                                level,
                                combo: combination,
                            })
                    }
                    ;(self._bindMultiple = function (
                        combinations,
                        callback,
                        action,
                    ) {
                        for (var i2 = 0; i2 < combinations.length; ++i2)
                            _bindSingle(combinations[i2], callback, action)
                    }),
                        _addEvent(targetElement, 'keypress', _handleKeyEvent),
                        _addEvent(targetElement, 'keydown', _handleKeyEvent),
                        _addEvent(targetElement, 'keyup', _handleKeyEvent)
                }
                ;(Mousetrap3.prototype.bind = function (
                    keys,
                    callback,
                    action,
                ) {
                    var self = this
                    return (
                        (keys = keys instanceof Array ? keys : [keys]),
                        self._bindMultiple.call(self, keys, callback, action),
                        self
                    )
                }),
                    (Mousetrap3.prototype.unbind = function (keys, action) {
                        var self = this
                        return self.bind.call(
                            self,
                            keys,
                            function () {},
                            action,
                        )
                    }),
                    (Mousetrap3.prototype.trigger = function (keys, action) {
                        var self = this
                        return (
                            self._directMap[keys + ':' + action] &&
                                self._directMap[keys + ':' + action]({}, keys),
                            self
                        )
                    }),
                    (Mousetrap3.prototype.reset = function () {
                        var self = this
                        return (
                            (self._callbacks = {}), (self._directMap = {}), self
                        )
                    }),
                    (Mousetrap3.prototype.stopCallback = function (e, element) {
                        var self = this
                        if (
                            (' ' + element.className + ' ').indexOf(
                                ' mousetrap ',
                            ) > -1 ||
                            _belongsTo(element, self.target)
                        )
                            return !1
                        if (
                            'composedPath' in e &&
                            typeof e.composedPath == 'function'
                        ) {
                            var initialEventTarget = e.composedPath()[0]
                            initialEventTarget !== e.target &&
                                (element = initialEventTarget)
                        }
                        return (
                            element.tagName == 'INPUT' ||
                            element.tagName == 'SELECT' ||
                            element.tagName == 'TEXTAREA' ||
                            element.isContentEditable
                        )
                    }),
                    (Mousetrap3.prototype.handleKey = function () {
                        var self = this
                        return self._handleKey.apply(self, arguments)
                    }),
                    (Mousetrap3.addKeycodes = function (object) {
                        for (var key in object)
                            object.hasOwnProperty(key) &&
                                (_MAP[key] = object[key])
                        _REVERSE_MAP = null
                    }),
                    (Mousetrap3.init = function () {
                        var documentMousetrap = Mousetrap3(document2)
                        for (var method in documentMousetrap)
                            method.charAt(0) !== '_' &&
                                (Mousetrap3[method] = (function (method2) {
                                    return function () {
                                        return documentMousetrap[method2].apply(
                                            documentMousetrap,
                                            arguments,
                                        )
                                    }
                                })(method))
                    }),
                    Mousetrap3.init(),
                    (window2.Mousetrap = Mousetrap3),
                    typeof module != 'undefined' &&
                        module.exports &&
                        (module.exports = Mousetrap3),
                    typeof define == 'function' &&
                        define.amd &&
                        define(function () {
                            return Mousetrap3
                        })
            })(
                typeof window != 'undefined' ? window : null,
                typeof window != 'undefined' ? document : null,
            )
        }),
        import_mousetrap = __toModule(require_mousetrap())
    ;(function (Mousetrap3) {
        if (!!Mousetrap3) {
            var _globalCallbacks = {},
                _originalStopCallback = Mousetrap3.prototype.stopCallback
            ;(Mousetrap3.prototype.stopCallback = function (
                e,
                element,
                combo,
                sequence,
            ) {
                var self = this
                return self.paused
                    ? !0
                    : _globalCallbacks[combo] || _globalCallbacks[sequence]
                    ? !1
                    : _originalStopCallback.call(self, e, element, combo)
            }),
                (Mousetrap3.prototype.bindGlobal = function (
                    keys,
                    callback,
                    action,
                ) {
                    var self = this
                    if (
                        (self.bind(keys, callback, action),
                        keys instanceof Array)
                    ) {
                        for (var i = 0; i < keys.length; i++)
                            _globalCallbacks[keys[i]] = !0
                        return
                    }
                    _globalCallbacks[keys] = !0
                }),
                Mousetrap3.init()
        }
    })(typeof Mousetrap != 'undefined' ? Mousetrap : void 0)
    var src_default2 = (Alpine2) => {
            Alpine2.directive(
                'mousetrap',
                (el, { modifiers, expression }, { evaluate: evaluate2 }) => {
                    let action = () =>
                        expression ? evaluate2(expression) : el.click()
                    ;(modifiers = modifiers.map((modifier) =>
                        modifier.replace('-', '+'),
                    )),
                        modifiers.includes('global') &&
                            ((modifiers = modifiers.filter(
                                (modifier) => modifier !== 'global',
                            )),
                            import_mousetrap.default.bindGlobal(
                                modifiers,
                                ($event) => {
                                    $event.preventDefault(), action()
                                },
                            )),
                        import_mousetrap.default.bind(modifiers, ($event) => {
                            $event.preventDefault(), action()
                        })
                },
            )
        },
        module_default2 = src_default2
    function src_default3(Alpine2) {
        let persist = () => {
            let alias,
                storage = localStorage
            return Alpine2.interceptor(
                (initialValue, getter, setter, path, key) => {
                    let lookup = alias || `_x_${path}`,
                        initial = storageHas(lookup, storage)
                            ? storageGet(lookup, storage)
                            : initialValue
                    return (
                        setter(initial),
                        Alpine2.effect(() => {
                            let value = getter()
                            storageSet(lookup, value, storage), setter(value)
                        }),
                        initial
                    )
                },
                (func) => {
                    ;(func.as = (key) => ((alias = key), func)),
                        (func.using = (target) => ((storage = target), func))
                },
            )
        }
        Object.defineProperty(Alpine2, '$persist', { get: () => persist() }),
            Alpine2.magic('persist', persist),
            (Alpine2.persist = (
                key,
                { get: get3, set: set3 },
                storage = localStorage,
            ) => {
                let initial = storageHas(key, storage)
                    ? storageGet(key, storage)
                    : get3()
                set3(initial),
                    Alpine2.effect(() => {
                        let value = get3()
                        storageSet(key, value, storage), set3(value)
                    })
            })
    }
    function storageHas(key, storage) {
        return storage.getItem(key) !== null
    }
    function storageGet(key, storage) {
        return JSON.parse(storage.getItem(key, storage))
    }
    function storageSet(key, value, storage) {
        storage.setItem(key, JSON.stringify(value))
    }
    var module_default3 = src_default3
    var __create2 = Object.create,
        __defProp2 = Object.defineProperty,
        __getProtoOf2 = Object.getPrototypeOf,
        __hasOwnProp2 = Object.prototype.hasOwnProperty,
        __getOwnPropNames2 = Object.getOwnPropertyNames,
        __getOwnPropDesc2 = Object.getOwnPropertyDescriptor,
        __markAsModule2 = (target) =>
            __defProp2(target, '__esModule', { value: !0 }),
        __commonJS2 = (callback, module) => () => (
            module ||
                ((module = { exports: {} }), callback(module.exports, module)),
            module.exports
        ),
        __exportStar2 = (target, module, desc) => {
            if (
                (module && typeof module == 'object') ||
                typeof module == 'function'
            )
                for (let key of __getOwnPropNames2(module))
                    !__hasOwnProp2.call(target, key) &&
                        key !== 'default' &&
                        __defProp2(target, key, {
                            get: () => module[key],
                            enumerable:
                                !(desc = __getOwnPropDesc2(module, key)) ||
                                desc.enumerable,
                        })
            return target
        },
        __toModule2 = (module) =>
            __exportStar2(
                __markAsModule2(
                    __defProp2(
                        module != null ? __create2(__getProtoOf2(module)) : {},
                        'default',
                        module && module.__esModule && 'default' in module
                            ? { get: () => module.default, enumerable: !0 }
                            : { value: module, enumerable: !0 },
                    ),
                ),
                module,
            ),
        require_popper = __commonJS2((exports) => {
            'use strict'
            Object.defineProperty(exports, '__esModule', { value: !0 })
            function getBoundingClientRect(element) {
                var rect = element.getBoundingClientRect()
                return {
                    width: rect.width,
                    height: rect.height,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                    left: rect.left,
                    x: rect.left,
                    y: rect.top,
                }
            }
            function getWindow(node) {
                if (node == null) return window
                if (node.toString() !== '[object Window]') {
                    var ownerDocument = node.ownerDocument
                    return (
                        (ownerDocument && ownerDocument.defaultView) || window
                    )
                }
                return node
            }
            function getWindowScroll(node) {
                var win = getWindow(node),
                    scrollLeft = win.pageXOffset,
                    scrollTop = win.pageYOffset
                return { scrollLeft, scrollTop }
            }
            function isElement(node) {
                var OwnElement = getWindow(node).Element
                return node instanceof OwnElement || node instanceof Element
            }
            function isHTMLElement(node) {
                var OwnElement = getWindow(node).HTMLElement
                return node instanceof OwnElement || node instanceof HTMLElement
            }
            function isShadowRoot(node) {
                if (typeof ShadowRoot == 'undefined') return !1
                var OwnElement = getWindow(node).ShadowRoot
                return node instanceof OwnElement || node instanceof ShadowRoot
            }
            function getHTMLElementScroll(element) {
                return {
                    scrollLeft: element.scrollLeft,
                    scrollTop: element.scrollTop,
                }
            }
            function getNodeScroll(node) {
                return node === getWindow(node) || !isHTMLElement(node)
                    ? getWindowScroll(node)
                    : getHTMLElementScroll(node)
            }
            function getNodeName(element) {
                return element ? (element.nodeName || '').toLowerCase() : null
            }
            function getDocumentElement(element) {
                return (
                    (isElement(element)
                        ? element.ownerDocument
                        : element.document) || window.document
                ).documentElement
            }
            function getWindowScrollBarX(element) {
                return (
                    getBoundingClientRect(getDocumentElement(element)).left +
                    getWindowScroll(element).scrollLeft
                )
            }
            function getComputedStyle2(element) {
                return getWindow(element).getComputedStyle(element)
            }
            function isScrollParent(element) {
                var _getComputedStyle = getComputedStyle2(element),
                    overflow = _getComputedStyle.overflow,
                    overflowX = _getComputedStyle.overflowX,
                    overflowY = _getComputedStyle.overflowY
                return /auto|scroll|overlay|hidden/.test(
                    overflow + overflowY + overflowX,
                )
            }
            function getCompositeRect(
                elementOrVirtualElement,
                offsetParent,
                isFixed,
            ) {
                isFixed === void 0 && (isFixed = !1)
                var documentElement = getDocumentElement(offsetParent),
                    rect = getBoundingClientRect(elementOrVirtualElement),
                    isOffsetParentAnElement = isHTMLElement(offsetParent),
                    scroll = { scrollLeft: 0, scrollTop: 0 },
                    offsets = { x: 0, y: 0 }
                return (
                    (isOffsetParentAnElement ||
                        (!isOffsetParentAnElement && !isFixed)) &&
                        ((getNodeName(offsetParent) !== 'body' ||
                            isScrollParent(documentElement)) &&
                            (scroll = getNodeScroll(offsetParent)),
                        isHTMLElement(offsetParent)
                            ? ((offsets = getBoundingClientRect(offsetParent)),
                              (offsets.x += offsetParent.clientLeft),
                              (offsets.y += offsetParent.clientTop))
                            : documentElement &&
                              (offsets.x =
                                  getWindowScrollBarX(documentElement))),
                    {
                        x: rect.left + scroll.scrollLeft - offsets.x,
                        y: rect.top + scroll.scrollTop - offsets.y,
                        width: rect.width,
                        height: rect.height,
                    }
                )
            }
            function getLayoutRect(element) {
                var clientRect = getBoundingClientRect(element),
                    width = element.offsetWidth,
                    height = element.offsetHeight
                return (
                    Math.abs(clientRect.width - width) <= 1 &&
                        (width = clientRect.width),
                    Math.abs(clientRect.height - height) <= 1 &&
                        (height = clientRect.height),
                    {
                        x: element.offsetLeft,
                        y: element.offsetTop,
                        width,
                        height,
                    }
                )
            }
            function getParentNode(element) {
                return getNodeName(element) === 'html'
                    ? element
                    : element.assignedSlot ||
                          element.parentNode ||
                          (isShadowRoot(element) ? element.host : null) ||
                          getDocumentElement(element)
            }
            function getScrollParent(node) {
                return ['html', 'body', '#document'].indexOf(
                    getNodeName(node),
                ) >= 0
                    ? node.ownerDocument.body
                    : isHTMLElement(node) && isScrollParent(node)
                    ? node
                    : getScrollParent(getParentNode(node))
            }
            function listScrollParents(element, list) {
                var _element$ownerDocumen
                list === void 0 && (list = [])
                var scrollParent = getScrollParent(element),
                    isBody =
                        scrollParent ===
                        ((_element$ownerDocumen = element.ownerDocument) == null
                            ? void 0
                            : _element$ownerDocumen.body),
                    win = getWindow(scrollParent),
                    target = isBody
                        ? [win].concat(
                              win.visualViewport || [],
                              isScrollParent(scrollParent) ? scrollParent : [],
                          )
                        : scrollParent,
                    updatedList = list.concat(target)
                return isBody
                    ? updatedList
                    : updatedList.concat(
                          listScrollParents(getParentNode(target)),
                      )
            }
            function isTableElement(element) {
                return ['table', 'td', 'th'].indexOf(getNodeName(element)) >= 0
            }
            function getTrueOffsetParent(element) {
                return !isHTMLElement(element) ||
                    getComputedStyle2(element).position === 'fixed'
                    ? null
                    : element.offsetParent
            }
            function getContainingBlock(element) {
                var isFirefox =
                        navigator.userAgent.toLowerCase().indexOf('firefox') !==
                        -1,
                    isIE = navigator.userAgent.indexOf('Trident') !== -1
                if (isIE && isHTMLElement(element)) {
                    var elementCss = getComputedStyle2(element)
                    if (elementCss.position === 'fixed') return null
                }
                for (
                    var currentNode = getParentNode(element);
                    isHTMLElement(currentNode) &&
                    ['html', 'body'].indexOf(getNodeName(currentNode)) < 0;

                ) {
                    var css = getComputedStyle2(currentNode)
                    if (
                        css.transform !== 'none' ||
                        css.perspective !== 'none' ||
                        css.contain === 'paint' ||
                        ['transform', 'perspective'].indexOf(css.willChange) !==
                            -1 ||
                        (isFirefox && css.willChange === 'filter') ||
                        (isFirefox && css.filter && css.filter !== 'none')
                    )
                        return currentNode
                    currentNode = currentNode.parentNode
                }
                return null
            }
            function getOffsetParent(element) {
                for (
                    var window2 = getWindow(element),
                        offsetParent = getTrueOffsetParent(element);
                    offsetParent &&
                    isTableElement(offsetParent) &&
                    getComputedStyle2(offsetParent).position === 'static';

                )
                    offsetParent = getTrueOffsetParent(offsetParent)
                return offsetParent &&
                    (getNodeName(offsetParent) === 'html' ||
                        (getNodeName(offsetParent) === 'body' &&
                            getComputedStyle2(offsetParent).position ===
                                'static'))
                    ? window2
                    : offsetParent || getContainingBlock(element) || window2
            }
            var top = 'top',
                bottom = 'bottom',
                right = 'right',
                left = 'left',
                auto = 'auto',
                basePlacements = [top, bottom, right, left],
                start2 = 'start',
                end = 'end',
                clippingParents = 'clippingParents',
                viewport = 'viewport',
                popper = 'popper',
                reference = 'reference',
                variationPlacements = basePlacements.reduce(function (
                    acc,
                    placement,
                ) {
                    return acc.concat([
                        placement + '-' + start2,
                        placement + '-' + end,
                    ])
                },
                []),
                placements = []
                    .concat(basePlacements, [auto])
                    .reduce(function (acc, placement) {
                        return acc.concat([
                            placement,
                            placement + '-' + start2,
                            placement + '-' + end,
                        ])
                    }, []),
                beforeRead = 'beforeRead',
                read = 'read',
                afterRead = 'afterRead',
                beforeMain = 'beforeMain',
                main = 'main',
                afterMain = 'afterMain',
                beforeWrite = 'beforeWrite',
                write = 'write',
                afterWrite = 'afterWrite',
                modifierPhases = [
                    beforeRead,
                    read,
                    afterRead,
                    beforeMain,
                    main,
                    afterMain,
                    beforeWrite,
                    write,
                    afterWrite,
                ]
            function order(modifiers) {
                var map = new Map(),
                    visited = new Set(),
                    result = []
                modifiers.forEach(function (modifier) {
                    map.set(modifier.name, modifier)
                })
                function sort(modifier) {
                    visited.add(modifier.name)
                    var requires = [].concat(
                        modifier.requires || [],
                        modifier.requiresIfExists || [],
                    )
                    requires.forEach(function (dep) {
                        if (!visited.has(dep)) {
                            var depModifier = map.get(dep)
                            depModifier && sort(depModifier)
                        }
                    }),
                        result.push(modifier)
                }
                return (
                    modifiers.forEach(function (modifier) {
                        visited.has(modifier.name) || sort(modifier)
                    }),
                    result
                )
            }
            function orderModifiers(modifiers) {
                var orderedModifiers = order(modifiers)
                return modifierPhases.reduce(function (acc, phase) {
                    return acc.concat(
                        orderedModifiers.filter(function (modifier) {
                            return modifier.phase === phase
                        }),
                    )
                }, [])
            }
            function debounce2(fn) {
                var pending
                return function () {
                    return (
                        pending ||
                            (pending = new Promise(function (resolve) {
                                Promise.resolve().then(function () {
                                    ;(pending = void 0), resolve(fn())
                                })
                            })),
                        pending
                    )
                }
            }
            function format(str) {
                for (
                    var _len = arguments.length,
                        args = new Array(_len > 1 ? _len - 1 : 0),
                        _key = 1;
                    _key < _len;
                    _key++
                )
                    args[_key - 1] = arguments[_key]
                return [].concat(args).reduce(function (p, c) {
                    return p.replace(/%s/, c)
                }, str)
            }
            var INVALID_MODIFIER_ERROR =
                    'Popper: modifier "%s" provided an invalid %s property, expected %s but got %s',
                MISSING_DEPENDENCY_ERROR =
                    'Popper: modifier "%s" requires "%s", but "%s" modifier is not available',
                VALID_PROPERTIES = [
                    'name',
                    'enabled',
                    'phase',
                    'fn',
                    'effect',
                    'requires',
                    'options',
                ]
            function validateModifiers(modifiers) {
                modifiers.forEach(function (modifier) {
                    Object.keys(modifier).forEach(function (key) {
                        switch (key) {
                            case 'name':
                                typeof modifier.name != 'string' &&
                                    console.error(
                                        format(
                                            INVALID_MODIFIER_ERROR,
                                            String(modifier.name),
                                            '"name"',
                                            '"string"',
                                            '"' + String(modifier.name) + '"',
                                        ),
                                    )
                                break
                            case 'enabled':
                                typeof modifier.enabled != 'boolean' &&
                                    console.error(
                                        format(
                                            INVALID_MODIFIER_ERROR,
                                            modifier.name,
                                            '"enabled"',
                                            '"boolean"',
                                            '"' +
                                                String(modifier.enabled) +
                                                '"',
                                        ),
                                    )
                            case 'phase':
                                modifierPhases.indexOf(modifier.phase) < 0 &&
                                    console.error(
                                        format(
                                            INVALID_MODIFIER_ERROR,
                                            modifier.name,
                                            '"phase"',
                                            'either ' +
                                                modifierPhases.join(', '),
                                            '"' + String(modifier.phase) + '"',
                                        ),
                                    )
                                break
                            case 'fn':
                                typeof modifier.fn != 'function' &&
                                    console.error(
                                        format(
                                            INVALID_MODIFIER_ERROR,
                                            modifier.name,
                                            '"fn"',
                                            '"function"',
                                            '"' + String(modifier.fn) + '"',
                                        ),
                                    )
                                break
                            case 'effect':
                                typeof modifier.effect != 'function' &&
                                    console.error(
                                        format(
                                            INVALID_MODIFIER_ERROR,
                                            modifier.name,
                                            '"effect"',
                                            '"function"',
                                            '"' + String(modifier.fn) + '"',
                                        ),
                                    )
                                break
                            case 'requires':
                                Array.isArray(modifier.requires) ||
                                    console.error(
                                        format(
                                            INVALID_MODIFIER_ERROR,
                                            modifier.name,
                                            '"requires"',
                                            '"array"',
                                            '"' +
                                                String(modifier.requires) +
                                                '"',
                                        ),
                                    )
                                break
                            case 'requiresIfExists':
                                Array.isArray(modifier.requiresIfExists) ||
                                    console.error(
                                        format(
                                            INVALID_MODIFIER_ERROR,
                                            modifier.name,
                                            '"requiresIfExists"',
                                            '"array"',
                                            '"' +
                                                String(
                                                    modifier.requiresIfExists,
                                                ) +
                                                '"',
                                        ),
                                    )
                                break
                            case 'options':
                            case 'data':
                                break
                            default:
                                console.error(
                                    'PopperJS: an invalid property has been provided to the "' +
                                        modifier.name +
                                        '" modifier, valid properties are ' +
                                        VALID_PROPERTIES.map(function (s) {
                                            return '"' + s + '"'
                                        }).join(', ') +
                                        '; but "' +
                                        key +
                                        '" was provided.',
                                )
                        }
                        modifier.requires &&
                            modifier.requires.forEach(function (requirement) {
                                modifiers.find(function (mod) {
                                    return mod.name === requirement
                                }) == null &&
                                    console.error(
                                        format(
                                            MISSING_DEPENDENCY_ERROR,
                                            String(modifier.name),
                                            requirement,
                                            requirement,
                                        ),
                                    )
                            })
                    })
                })
            }
            function uniqueBy(arr, fn) {
                var identifiers = new Set()
                return arr.filter(function (item) {
                    var identifier = fn(item)
                    if (!identifiers.has(identifier))
                        return identifiers.add(identifier), !0
                })
            }
            function getBasePlacement(placement) {
                return placement.split('-')[0]
            }
            function mergeByName(modifiers) {
                var merged = modifiers.reduce(function (merged2, current) {
                    var existing = merged2[current.name]
                    return (
                        (merged2[current.name] = existing
                            ? Object.assign({}, existing, current, {
                                  options: Object.assign(
                                      {},
                                      existing.options,
                                      current.options,
                                  ),
                                  data: Object.assign(
                                      {},
                                      existing.data,
                                      current.data,
                                  ),
                              })
                            : current),
                        merged2
                    )
                }, {})
                return Object.keys(merged).map(function (key) {
                    return merged[key]
                })
            }
            function getViewportRect(element) {
                var win = getWindow(element),
                    html = getDocumentElement(element),
                    visualViewport = win.visualViewport,
                    width = html.clientWidth,
                    height = html.clientHeight,
                    x = 0,
                    y = 0
                return (
                    visualViewport &&
                        ((width = visualViewport.width),
                        (height = visualViewport.height),
                        /^((?!chrome|android).)*safari/i.test(
                            navigator.userAgent,
                        ) ||
                            ((x = visualViewport.offsetLeft),
                            (y = visualViewport.offsetTop))),
                    { width, height, x: x + getWindowScrollBarX(element), y }
                )
            }
            var max = Math.max,
                min = Math.min,
                round = Math.round
            function getDocumentRect(element) {
                var _element$ownerDocumen,
                    html = getDocumentElement(element),
                    winScroll = getWindowScroll(element),
                    body =
                        (_element$ownerDocumen = element.ownerDocument) == null
                            ? void 0
                            : _element$ownerDocumen.body,
                    width = max(
                        html.scrollWidth,
                        html.clientWidth,
                        body ? body.scrollWidth : 0,
                        body ? body.clientWidth : 0,
                    ),
                    height = max(
                        html.scrollHeight,
                        html.clientHeight,
                        body ? body.scrollHeight : 0,
                        body ? body.clientHeight : 0,
                    ),
                    x = -winScroll.scrollLeft + getWindowScrollBarX(element),
                    y = -winScroll.scrollTop
                return (
                    getComputedStyle2(body || html).direction === 'rtl' &&
                        (x +=
                            max(html.clientWidth, body ? body.clientWidth : 0) -
                            width),
                    { width, height, x, y }
                )
            }
            function contains(parent, child) {
                var rootNode = child.getRootNode && child.getRootNode()
                if (parent.contains(child)) return !0
                if (rootNode && isShadowRoot(rootNode)) {
                    var next = child
                    do {
                        if (next && parent.isSameNode(next)) return !0
                        next = next.parentNode || next.host
                    } while (next)
                }
                return !1
            }
            function rectToClientRect(rect) {
                return Object.assign({}, rect, {
                    left: rect.x,
                    top: rect.y,
                    right: rect.x + rect.width,
                    bottom: rect.y + rect.height,
                })
            }
            function getInnerBoundingClientRect(element) {
                var rect = getBoundingClientRect(element)
                return (
                    (rect.top = rect.top + element.clientTop),
                    (rect.left = rect.left + element.clientLeft),
                    (rect.bottom = rect.top + element.clientHeight),
                    (rect.right = rect.left + element.clientWidth),
                    (rect.width = element.clientWidth),
                    (rect.height = element.clientHeight),
                    (rect.x = rect.left),
                    (rect.y = rect.top),
                    rect
                )
            }
            function getClientRectFromMixedType(element, clippingParent) {
                return clippingParent === viewport
                    ? rectToClientRect(getViewportRect(element))
                    : isHTMLElement(clippingParent)
                    ? getInnerBoundingClientRect(clippingParent)
                    : rectToClientRect(
                          getDocumentRect(getDocumentElement(element)),
                      )
            }
            function getClippingParents(element) {
                var clippingParents2 = listScrollParents(
                        getParentNode(element),
                    ),
                    canEscapeClipping =
                        ['absolute', 'fixed'].indexOf(
                            getComputedStyle2(element).position,
                        ) >= 0,
                    clipperElement =
                        canEscapeClipping && isHTMLElement(element)
                            ? getOffsetParent(element)
                            : element
                return isElement(clipperElement)
                    ? clippingParents2.filter(function (clippingParent) {
                          return (
                              isElement(clippingParent) &&
                              contains(clippingParent, clipperElement) &&
                              getNodeName(clippingParent) !== 'body'
                          )
                      })
                    : []
            }
            function getClippingRect(element, boundary, rootBoundary) {
                var mainClippingParents =
                        boundary === 'clippingParents'
                            ? getClippingParents(element)
                            : [].concat(boundary),
                    clippingParents2 = [].concat(mainClippingParents, [
                        rootBoundary,
                    ]),
                    firstClippingParent = clippingParents2[0],
                    clippingRect = clippingParents2.reduce(function (
                        accRect,
                        clippingParent,
                    ) {
                        var rect = getClientRectFromMixedType(
                            element,
                            clippingParent,
                        )
                        return (
                            (accRect.top = max(rect.top, accRect.top)),
                            (accRect.right = min(rect.right, accRect.right)),
                            (accRect.bottom = min(rect.bottom, accRect.bottom)),
                            (accRect.left = max(rect.left, accRect.left)),
                            accRect
                        )
                    },
                    getClientRectFromMixedType(element, firstClippingParent))
                return (
                    (clippingRect.width =
                        clippingRect.right - clippingRect.left),
                    (clippingRect.height =
                        clippingRect.bottom - clippingRect.top),
                    (clippingRect.x = clippingRect.left),
                    (clippingRect.y = clippingRect.top),
                    clippingRect
                )
            }
            function getVariation(placement) {
                return placement.split('-')[1]
            }
            function getMainAxisFromPlacement(placement) {
                return ['top', 'bottom'].indexOf(placement) >= 0 ? 'x' : 'y'
            }
            function computeOffsets(_ref) {
                var reference2 = _ref.reference,
                    element = _ref.element,
                    placement = _ref.placement,
                    basePlacement = placement
                        ? getBasePlacement(placement)
                        : null,
                    variation = placement ? getVariation(placement) : null,
                    commonX =
                        reference2.x + reference2.width / 2 - element.width / 2,
                    commonY =
                        reference2.y +
                        reference2.height / 2 -
                        element.height / 2,
                    offsets
                switch (basePlacement) {
                    case top:
                        offsets = {
                            x: commonX,
                            y: reference2.y - element.height,
                        }
                        break
                    case bottom:
                        offsets = {
                            x: commonX,
                            y: reference2.y + reference2.height,
                        }
                        break
                    case right:
                        offsets = {
                            x: reference2.x + reference2.width,
                            y: commonY,
                        }
                        break
                    case left:
                        offsets = {
                            x: reference2.x - element.width,
                            y: commonY,
                        }
                        break
                    default:
                        offsets = { x: reference2.x, y: reference2.y }
                }
                var mainAxis = basePlacement
                    ? getMainAxisFromPlacement(basePlacement)
                    : null
                if (mainAxis != null) {
                    var len = mainAxis === 'y' ? 'height' : 'width'
                    switch (variation) {
                        case start2:
                            offsets[mainAxis] =
                                offsets[mainAxis] -
                                (reference2[len] / 2 - element[len] / 2)
                            break
                        case end:
                            offsets[mainAxis] =
                                offsets[mainAxis] +
                                (reference2[len] / 2 - element[len] / 2)
                            break
                    }
                }
                return offsets
            }
            function getFreshSideObject() {
                return { top: 0, right: 0, bottom: 0, left: 0 }
            }
            function mergePaddingObject(paddingObject) {
                return Object.assign({}, getFreshSideObject(), paddingObject)
            }
            function expandToHashMap(value, keys) {
                return keys.reduce(function (hashMap, key) {
                    return (hashMap[key] = value), hashMap
                }, {})
            }
            function detectOverflow(state, options) {
                options === void 0 && (options = {})
                var _options = options,
                    _options$placement = _options.placement,
                    placement =
                        _options$placement === void 0
                            ? state.placement
                            : _options$placement,
                    _options$boundary = _options.boundary,
                    boundary =
                        _options$boundary === void 0
                            ? clippingParents
                            : _options$boundary,
                    _options$rootBoundary = _options.rootBoundary,
                    rootBoundary =
                        _options$rootBoundary === void 0
                            ? viewport
                            : _options$rootBoundary,
                    _options$elementConte = _options.elementContext,
                    elementContext =
                        _options$elementConte === void 0
                            ? popper
                            : _options$elementConte,
                    _options$altBoundary = _options.altBoundary,
                    altBoundary =
                        _options$altBoundary === void 0
                            ? !1
                            : _options$altBoundary,
                    _options$padding = _options.padding,
                    padding =
                        _options$padding === void 0 ? 0 : _options$padding,
                    paddingObject = mergePaddingObject(
                        typeof padding != 'number'
                            ? padding
                            : expandToHashMap(padding, basePlacements),
                    ),
                    altContext = elementContext === popper ? reference : popper,
                    referenceElement = state.elements.reference,
                    popperRect = state.rects.popper,
                    element =
                        state.elements[
                            altBoundary ? altContext : elementContext
                        ],
                    clippingClientRect = getClippingRect(
                        isElement(element)
                            ? element
                            : element.contextElement ||
                                  getDocumentElement(state.elements.popper),
                        boundary,
                        rootBoundary,
                    ),
                    referenceClientRect =
                        getBoundingClientRect(referenceElement),
                    popperOffsets2 = computeOffsets({
                        reference: referenceClientRect,
                        element: popperRect,
                        strategy: 'absolute',
                        placement,
                    }),
                    popperClientRect = rectToClientRect(
                        Object.assign({}, popperRect, popperOffsets2),
                    ),
                    elementClientRect =
                        elementContext === popper
                            ? popperClientRect
                            : referenceClientRect,
                    overflowOffsets = {
                        top:
                            clippingClientRect.top -
                            elementClientRect.top +
                            paddingObject.top,
                        bottom:
                            elementClientRect.bottom -
                            clippingClientRect.bottom +
                            paddingObject.bottom,
                        left:
                            clippingClientRect.left -
                            elementClientRect.left +
                            paddingObject.left,
                        right:
                            elementClientRect.right -
                            clippingClientRect.right +
                            paddingObject.right,
                    },
                    offsetData = state.modifiersData.offset
                if (elementContext === popper && offsetData) {
                    var offset2 = offsetData[placement]
                    Object.keys(overflowOffsets).forEach(function (key) {
                        var multiply =
                                [right, bottom].indexOf(key) >= 0 ? 1 : -1,
                            axis = [top, bottom].indexOf(key) >= 0 ? 'y' : 'x'
                        overflowOffsets[key] += offset2[axis] * multiply
                    })
                }
                return overflowOffsets
            }
            var INVALID_ELEMENT_ERROR =
                    'Popper: Invalid reference or popper argument provided. They must be either a DOM element or virtual element.',
                INFINITE_LOOP_ERROR =
                    'Popper: An infinite loop in the modifiers cycle has been detected! The cycle has been interrupted to prevent a browser crash.',
                DEFAULT_OPTIONS = {
                    placement: 'bottom',
                    modifiers: [],
                    strategy: 'absolute',
                }
            function areValidElements() {
                for (
                    var _len = arguments.length,
                        args = new Array(_len),
                        _key = 0;
                    _key < _len;
                    _key++
                )
                    args[_key] = arguments[_key]
                return !args.some(function (element) {
                    return !(
                        element &&
                        typeof element.getBoundingClientRect == 'function'
                    )
                })
            }
            function popperGenerator(generatorOptions) {
                generatorOptions === void 0 && (generatorOptions = {})
                var _generatorOptions = generatorOptions,
                    _generatorOptions$def = _generatorOptions.defaultModifiers,
                    defaultModifiers2 =
                        _generatorOptions$def === void 0
                            ? []
                            : _generatorOptions$def,
                    _generatorOptions$def2 = _generatorOptions.defaultOptions,
                    defaultOptions =
                        _generatorOptions$def2 === void 0
                            ? DEFAULT_OPTIONS
                            : _generatorOptions$def2
                return function (reference2, popper2, options) {
                    options === void 0 && (options = defaultOptions)
                    var state = {
                            placement: 'bottom',
                            orderedModifiers: [],
                            options: Object.assign(
                                {},
                                DEFAULT_OPTIONS,
                                defaultOptions,
                            ),
                            modifiersData: {},
                            elements: {
                                reference: reference2,
                                popper: popper2,
                            },
                            attributes: {},
                            styles: {},
                        },
                        effectCleanupFns = [],
                        isDestroyed = !1,
                        instance = {
                            state,
                            setOptions: function (options2) {
                                cleanupModifierEffects(),
                                    (state.options = Object.assign(
                                        {},
                                        defaultOptions,
                                        state.options,
                                        options2,
                                    )),
                                    (state.scrollParents = {
                                        reference: isElement(reference2)
                                            ? listScrollParents(reference2)
                                            : reference2.contextElement
                                            ? listScrollParents(
                                                  reference2.contextElement,
                                              )
                                            : [],
                                        popper: listScrollParents(popper2),
                                    })
                                var orderedModifiers = orderModifiers(
                                    mergeByName(
                                        [].concat(
                                            defaultModifiers2,
                                            state.options.modifiers,
                                        ),
                                    ),
                                )
                                state.orderedModifiers =
                                    orderedModifiers.filter(function (m) {
                                        return m.enabled
                                    })
                                var modifiers = uniqueBy(
                                    [].concat(
                                        orderedModifiers,
                                        state.options.modifiers,
                                    ),
                                    function (_ref) {
                                        var name = _ref.name
                                        return name
                                    },
                                )
                                if (
                                    (validateModifiers(modifiers),
                                    getBasePlacement(
                                        state.options.placement,
                                    ) === auto)
                                ) {
                                    var flipModifier =
                                        state.orderedModifiers.find(function (
                                            _ref2,
                                        ) {
                                            var name = _ref2.name
                                            return name === 'flip'
                                        })
                                    flipModifier ||
                                        console.error(
                                            [
                                                'Popper: "auto" placements require the "flip" modifier be',
                                                'present and enabled to work.',
                                            ].join(' '),
                                        )
                                }
                                var _getComputedStyle =
                                        getComputedStyle2(popper2),
                                    marginTop = _getComputedStyle.marginTop,
                                    marginRight = _getComputedStyle.marginRight,
                                    marginBottom =
                                        _getComputedStyle.marginBottom,
                                    marginLeft = _getComputedStyle.marginLeft
                                return (
                                    [
                                        marginTop,
                                        marginRight,
                                        marginBottom,
                                        marginLeft,
                                    ].some(function (margin) {
                                        return parseFloat(margin)
                                    }) &&
                                        console.warn(
                                            [
                                                'Popper: CSS "margin" styles cannot be used to apply padding',
                                                'between the popper and its reference element or boundary.',
                                                'To replicate margin, use the `offset` modifier, as well as',
                                                'the `padding` option in the `preventOverflow` and `flip`',
                                                'modifiers.',
                                            ].join(' '),
                                        ),
                                    runModifierEffects(),
                                    instance.update()
                                )
                            },
                            forceUpdate: function () {
                                if (!isDestroyed) {
                                    var _state$elements = state.elements,
                                        reference3 = _state$elements.reference,
                                        popper3 = _state$elements.popper
                                    if (
                                        !areValidElements(reference3, popper3)
                                    ) {
                                        console.error(INVALID_ELEMENT_ERROR)
                                        return
                                    }
                                    ;(state.rects = {
                                        reference: getCompositeRect(
                                            reference3,
                                            getOffsetParent(popper3),
                                            state.options.strategy === 'fixed',
                                        ),
                                        popper: getLayoutRect(popper3),
                                    }),
                                        (state.reset = !1),
                                        (state.placement =
                                            state.options.placement),
                                        state.orderedModifiers.forEach(
                                            function (modifier) {
                                                return (state.modifiersData[
                                                    modifier.name
                                                ] = Object.assign(
                                                    {},
                                                    modifier.data,
                                                ))
                                            },
                                        )
                                    for (
                                        var __debug_loops__ = 0, index = 0;
                                        index < state.orderedModifiers.length;
                                        index++
                                    ) {
                                        if (
                                            ((__debug_loops__ += 1),
                                            __debug_loops__ > 100)
                                        ) {
                                            console.error(INFINITE_LOOP_ERROR)
                                            break
                                        }
                                        if (state.reset === !0) {
                                            ;(state.reset = !1), (index = -1)
                                            continue
                                        }
                                        var _state$orderedModifie =
                                                state.orderedModifiers[index],
                                            fn = _state$orderedModifie.fn,
                                            _state$orderedModifie2 =
                                                _state$orderedModifie.options,
                                            _options =
                                                _state$orderedModifie2 ===
                                                void 0
                                                    ? {}
                                                    : _state$orderedModifie2,
                                            name = _state$orderedModifie.name
                                        typeof fn == 'function' &&
                                            (state =
                                                fn({
                                                    state,
                                                    options: _options,
                                                    name,
                                                    instance,
                                                }) || state)
                                    }
                                }
                            },
                            update: debounce2(function () {
                                return new Promise(function (resolve) {
                                    instance.forceUpdate(), resolve(state)
                                })
                            }),
                            destroy: function () {
                                cleanupModifierEffects(), (isDestroyed = !0)
                            },
                        }
                    if (!areValidElements(reference2, popper2))
                        return console.error(INVALID_ELEMENT_ERROR), instance
                    instance.setOptions(options).then(function (state2) {
                        !isDestroyed &&
                            options.onFirstUpdate &&
                            options.onFirstUpdate(state2)
                    })
                    function runModifierEffects() {
                        state.orderedModifiers.forEach(function (_ref3) {
                            var name = _ref3.name,
                                _ref3$options = _ref3.options,
                                options2 =
                                    _ref3$options === void 0
                                        ? {}
                                        : _ref3$options,
                                effect22 = _ref3.effect
                            if (typeof effect22 == 'function') {
                                var cleanupFn = effect22({
                                        state,
                                        name,
                                        instance,
                                        options: options2,
                                    }),
                                    noopFn = function () {}
                                effectCleanupFns.push(cleanupFn || noopFn)
                            }
                        })
                    }
                    function cleanupModifierEffects() {
                        effectCleanupFns.forEach(function (fn) {
                            return fn()
                        }),
                            (effectCleanupFns = [])
                    }
                    return instance
                }
            }
            var passive = { passive: !0 }
            function effect$2(_ref) {
                var state = _ref.state,
                    instance = _ref.instance,
                    options = _ref.options,
                    _options$scroll = options.scroll,
                    scroll = _options$scroll === void 0 ? !0 : _options$scroll,
                    _options$resize = options.resize,
                    resize = _options$resize === void 0 ? !0 : _options$resize,
                    window2 = getWindow(state.elements.popper),
                    scrollParents = [].concat(
                        state.scrollParents.reference,
                        state.scrollParents.popper,
                    )
                return (
                    scroll &&
                        scrollParents.forEach(function (scrollParent) {
                            scrollParent.addEventListener(
                                'scroll',
                                instance.update,
                                passive,
                            )
                        }),
                    resize &&
                        window2.addEventListener(
                            'resize',
                            instance.update,
                            passive,
                        ),
                    function () {
                        scroll &&
                            scrollParents.forEach(function (scrollParent) {
                                scrollParent.removeEventListener(
                                    'scroll',
                                    instance.update,
                                    passive,
                                )
                            }),
                            resize &&
                                window2.removeEventListener(
                                    'resize',
                                    instance.update,
                                    passive,
                                )
                    }
                )
            }
            var eventListeners = {
                name: 'eventListeners',
                enabled: !0,
                phase: 'write',
                fn: function () {},
                effect: effect$2,
                data: {},
            }
            function popperOffsets(_ref) {
                var state = _ref.state,
                    name = _ref.name
                state.modifiersData[name] = computeOffsets({
                    reference: state.rects.reference,
                    element: state.rects.popper,
                    strategy: 'absolute',
                    placement: state.placement,
                })
            }
            var popperOffsets$1 = {
                    name: 'popperOffsets',
                    enabled: !0,
                    phase: 'read',
                    fn: popperOffsets,
                    data: {},
                },
                unsetSides = {
                    top: 'auto',
                    right: 'auto',
                    bottom: 'auto',
                    left: 'auto',
                }
            function roundOffsetsByDPR(_ref) {
                var x = _ref.x,
                    y = _ref.y,
                    win = window,
                    dpr = win.devicePixelRatio || 1
                return {
                    x: round(round(x * dpr) / dpr) || 0,
                    y: round(round(y * dpr) / dpr) || 0,
                }
            }
            function mapToStyles(_ref2) {
                var _Object$assign2,
                    popper2 = _ref2.popper,
                    popperRect = _ref2.popperRect,
                    placement = _ref2.placement,
                    offsets = _ref2.offsets,
                    position = _ref2.position,
                    gpuAcceleration = _ref2.gpuAcceleration,
                    adaptive = _ref2.adaptive,
                    roundOffsets = _ref2.roundOffsets,
                    _ref3 =
                        roundOffsets === !0
                            ? roundOffsetsByDPR(offsets)
                            : typeof roundOffsets == 'function'
                            ? roundOffsets(offsets)
                            : offsets,
                    _ref3$x = _ref3.x,
                    x = _ref3$x === void 0 ? 0 : _ref3$x,
                    _ref3$y = _ref3.y,
                    y = _ref3$y === void 0 ? 0 : _ref3$y,
                    hasX = offsets.hasOwnProperty('x'),
                    hasY = offsets.hasOwnProperty('y'),
                    sideX = left,
                    sideY = top,
                    win = window
                if (adaptive) {
                    var offsetParent = getOffsetParent(popper2),
                        heightProp = 'clientHeight',
                        widthProp = 'clientWidth'
                    offsetParent === getWindow(popper2) &&
                        ((offsetParent = getDocumentElement(popper2)),
                        getComputedStyle2(offsetParent).position !== 'static' &&
                            ((heightProp = 'scrollHeight'),
                            (widthProp = 'scrollWidth'))),
                        (offsetParent = offsetParent),
                        placement === top &&
                            ((sideY = bottom),
                            (y -= offsetParent[heightProp] - popperRect.height),
                            (y *= gpuAcceleration ? 1 : -1)),
                        placement === left &&
                            ((sideX = right),
                            (x -= offsetParent[widthProp] - popperRect.width),
                            (x *= gpuAcceleration ? 1 : -1))
                }
                var commonStyles = Object.assign(
                    { position },
                    adaptive && unsetSides,
                )
                if (gpuAcceleration) {
                    var _Object$assign
                    return Object.assign(
                        {},
                        commonStyles,
                        ((_Object$assign = {}),
                        (_Object$assign[sideY] = hasY ? '0' : ''),
                        (_Object$assign[sideX] = hasX ? '0' : ''),
                        (_Object$assign.transform =
                            (win.devicePixelRatio || 1) < 2
                                ? 'translate(' + x + 'px, ' + y + 'px)'
                                : 'translate3d(' + x + 'px, ' + y + 'px, 0)'),
                        _Object$assign),
                    )
                }
                return Object.assign(
                    {},
                    commonStyles,
                    ((_Object$assign2 = {}),
                    (_Object$assign2[sideY] = hasY ? y + 'px' : ''),
                    (_Object$assign2[sideX] = hasX ? x + 'px' : ''),
                    (_Object$assign2.transform = ''),
                    _Object$assign2),
                )
            }
            function computeStyles(_ref4) {
                var state = _ref4.state,
                    options = _ref4.options,
                    _options$gpuAccelerat = options.gpuAcceleration,
                    gpuAcceleration =
                        _options$gpuAccelerat === void 0
                            ? !0
                            : _options$gpuAccelerat,
                    _options$adaptive = options.adaptive,
                    adaptive =
                        _options$adaptive === void 0 ? !0 : _options$adaptive,
                    _options$roundOffsets = options.roundOffsets,
                    roundOffsets =
                        _options$roundOffsets === void 0
                            ? !0
                            : _options$roundOffsets,
                    transitionProperty =
                        getComputedStyle2(state.elements.popper)
                            .transitionProperty || ''
                adaptive &&
                    ['transform', 'top', 'right', 'bottom', 'left'].some(
                        function (property) {
                            return transitionProperty.indexOf(property) >= 0
                        },
                    ) &&
                    console.warn(
                        [
                            'Popper: Detected CSS transitions on at least one of the following',
                            'CSS properties: "transform", "top", "right", "bottom", "left".',
                            `

`,
                            'Disable the "computeStyles" modifier\'s `adaptive` option to allow',
                            'for smooth transitions, or remove these properties from the CSS',
                            'transition declaration on the popper element if only transitioning',
                            'opacity or background-color for example.',
                            `

`,
                            'We recommend using the popper element as a wrapper around an inner',
                            'element that can have any CSS property transitioned for animations.',
                        ].join(' '),
                    )
                var commonStyles = {
                    placement: getBasePlacement(state.placement),
                    popper: state.elements.popper,
                    popperRect: state.rects.popper,
                    gpuAcceleration,
                }
                state.modifiersData.popperOffsets != null &&
                    (state.styles.popper = Object.assign(
                        {},
                        state.styles.popper,
                        mapToStyles(
                            Object.assign({}, commonStyles, {
                                offsets: state.modifiersData.popperOffsets,
                                position: state.options.strategy,
                                adaptive,
                                roundOffsets,
                            }),
                        ),
                    )),
                    state.modifiersData.arrow != null &&
                        (state.styles.arrow = Object.assign(
                            {},
                            state.styles.arrow,
                            mapToStyles(
                                Object.assign({}, commonStyles, {
                                    offsets: state.modifiersData.arrow,
                                    position: 'absolute',
                                    adaptive: !1,
                                    roundOffsets,
                                }),
                            ),
                        )),
                    (state.attributes.popper = Object.assign(
                        {},
                        state.attributes.popper,
                        { 'data-popper-placement': state.placement },
                    ))
            }
            var computeStyles$1 = {
                name: 'computeStyles',
                enabled: !0,
                phase: 'beforeWrite',
                fn: computeStyles,
                data: {},
            }
            function applyStyles(_ref) {
                var state = _ref.state
                Object.keys(state.elements).forEach(function (name) {
                    var style = state.styles[name] || {},
                        attributes = state.attributes[name] || {},
                        element = state.elements[name]
                    !isHTMLElement(element) ||
                        !getNodeName(element) ||
                        (Object.assign(element.style, style),
                        Object.keys(attributes).forEach(function (name2) {
                            var value = attributes[name2]
                            value === !1
                                ? element.removeAttribute(name2)
                                : element.setAttribute(
                                      name2,
                                      value === !0 ? '' : value,
                                  )
                        }))
                })
            }
            function effect$1(_ref2) {
                var state = _ref2.state,
                    initialStyles = {
                        popper: {
                            position: state.options.strategy,
                            left: '0',
                            top: '0',
                            margin: '0',
                        },
                        arrow: { position: 'absolute' },
                        reference: {},
                    }
                return (
                    Object.assign(
                        state.elements.popper.style,
                        initialStyles.popper,
                    ),
                    (state.styles = initialStyles),
                    state.elements.arrow &&
                        Object.assign(
                            state.elements.arrow.style,
                            initialStyles.arrow,
                        ),
                    function () {
                        Object.keys(state.elements).forEach(function (name) {
                            var element = state.elements[name],
                                attributes = state.attributes[name] || {},
                                styleProperties = Object.keys(
                                    state.styles.hasOwnProperty(name)
                                        ? state.styles[name]
                                        : initialStyles[name],
                                ),
                                style = styleProperties.reduce(function (
                                    style2,
                                    property,
                                ) {
                                    return (style2[property] = ''), style2
                                },
                                {})
                            !isHTMLElement(element) ||
                                !getNodeName(element) ||
                                (Object.assign(element.style, style),
                                Object.keys(attributes).forEach(function (
                                    attribute,
                                ) {
                                    element.removeAttribute(attribute)
                                }))
                        })
                    }
                )
            }
            var applyStyles$1 = {
                name: 'applyStyles',
                enabled: !0,
                phase: 'write',
                fn: applyStyles,
                effect: effect$1,
                requires: ['computeStyles'],
            }
            function distanceAndSkiddingToXY(placement, rects, offset2) {
                var basePlacement = getBasePlacement(placement),
                    invertDistance =
                        [left, top].indexOf(basePlacement) >= 0 ? -1 : 1,
                    _ref =
                        typeof offset2 == 'function'
                            ? offset2(Object.assign({}, rects, { placement }))
                            : offset2,
                    skidding = _ref[0],
                    distance = _ref[1]
                return (
                    (skidding = skidding || 0),
                    (distance = (distance || 0) * invertDistance),
                    [left, right].indexOf(basePlacement) >= 0
                        ? { x: distance, y: skidding }
                        : { x: skidding, y: distance }
                )
            }
            function offset(_ref2) {
                var state = _ref2.state,
                    options = _ref2.options,
                    name = _ref2.name,
                    _options$offset = options.offset,
                    offset2 =
                        _options$offset === void 0 ? [0, 0] : _options$offset,
                    data2 = placements.reduce(function (acc, placement) {
                        return (
                            (acc[placement] = distanceAndSkiddingToXY(
                                placement,
                                state.rects,
                                offset2,
                            )),
                            acc
                        )
                    }, {}),
                    _data$state$placement = data2[state.placement],
                    x = _data$state$placement.x,
                    y = _data$state$placement.y
                state.modifiersData.popperOffsets != null &&
                    ((state.modifiersData.popperOffsets.x += x),
                    (state.modifiersData.popperOffsets.y += y)),
                    (state.modifiersData[name] = data2)
            }
            var offset$1 = {
                    name: 'offset',
                    enabled: !0,
                    phase: 'main',
                    requires: ['popperOffsets'],
                    fn: offset,
                },
                hash$1 = {
                    left: 'right',
                    right: 'left',
                    bottom: 'top',
                    top: 'bottom',
                }
            function getOppositePlacement(placement) {
                return placement.replace(
                    /left|right|bottom|top/g,
                    function (matched) {
                        return hash$1[matched]
                    },
                )
            }
            var hash = { start: 'end', end: 'start' }
            function getOppositeVariationPlacement(placement) {
                return placement.replace(/start|end/g, function (matched) {
                    return hash[matched]
                })
            }
            function computeAutoPlacement(state, options) {
                options === void 0 && (options = {})
                var _options = options,
                    placement = _options.placement,
                    boundary = _options.boundary,
                    rootBoundary = _options.rootBoundary,
                    padding = _options.padding,
                    flipVariations = _options.flipVariations,
                    _options$allowedAutoP = _options.allowedAutoPlacements,
                    allowedAutoPlacements =
                        _options$allowedAutoP === void 0
                            ? placements
                            : _options$allowedAutoP,
                    variation = getVariation(placement),
                    placements$1 = variation
                        ? flipVariations
                            ? variationPlacements
                            : variationPlacements.filter(function (placement2) {
                                  return getVariation(placement2) === variation
                              })
                        : basePlacements,
                    allowedPlacements = placements$1.filter(function (
                        placement2,
                    ) {
                        return allowedAutoPlacements.indexOf(placement2) >= 0
                    })
                allowedPlacements.length === 0 &&
                    ((allowedPlacements = placements$1),
                    console.error(
                        [
                            'Popper: The `allowedAutoPlacements` option did not allow any',
                            'placements. Ensure the `placement` option matches the variation',
                            'of the allowed placements.',
                            'For example, "auto" cannot be used to allow "bottom-start".',
                            'Use "auto-start" instead.',
                        ].join(' '),
                    ))
                var overflows = allowedPlacements.reduce(function (
                    acc,
                    placement2,
                ) {
                    return (
                        (acc[placement2] = detectOverflow(state, {
                            placement: placement2,
                            boundary,
                            rootBoundary,
                            padding,
                        })[getBasePlacement(placement2)]),
                        acc
                    )
                },
                {})
                return Object.keys(overflows).sort(function (a, b) {
                    return overflows[a] - overflows[b]
                })
            }
            function getExpandedFallbackPlacements(placement) {
                if (getBasePlacement(placement) === auto) return []
                var oppositePlacement = getOppositePlacement(placement)
                return [
                    getOppositeVariationPlacement(placement),
                    oppositePlacement,
                    getOppositeVariationPlacement(oppositePlacement),
                ]
            }
            function flip(_ref) {
                var state = _ref.state,
                    options = _ref.options,
                    name = _ref.name
                if (!state.modifiersData[name]._skip) {
                    for (
                        var _options$mainAxis = options.mainAxis,
                            checkMainAxis =
                                _options$mainAxis === void 0
                                    ? !0
                                    : _options$mainAxis,
                            _options$altAxis = options.altAxis,
                            checkAltAxis =
                                _options$altAxis === void 0
                                    ? !0
                                    : _options$altAxis,
                            specifiedFallbackPlacements =
                                options.fallbackPlacements,
                            padding = options.padding,
                            boundary = options.boundary,
                            rootBoundary = options.rootBoundary,
                            altBoundary = options.altBoundary,
                            _options$flipVariatio = options.flipVariations,
                            flipVariations =
                                _options$flipVariatio === void 0
                                    ? !0
                                    : _options$flipVariatio,
                            allowedAutoPlacements =
                                options.allowedAutoPlacements,
                            preferredPlacement = state.options.placement,
                            basePlacement =
                                getBasePlacement(preferredPlacement),
                            isBasePlacement =
                                basePlacement === preferredPlacement,
                            fallbackPlacements =
                                specifiedFallbackPlacements ||
                                (isBasePlacement || !flipVariations
                                    ? [getOppositePlacement(preferredPlacement)]
                                    : getExpandedFallbackPlacements(
                                          preferredPlacement,
                                      )),
                            placements2 = [preferredPlacement]
                                .concat(fallbackPlacements)
                                .reduce(function (acc, placement2) {
                                    return acc.concat(
                                        getBasePlacement(placement2) === auto
                                            ? computeAutoPlacement(state, {
                                                  placement: placement2,
                                                  boundary,
                                                  rootBoundary,
                                                  padding,
                                                  flipVariations,
                                                  allowedAutoPlacements,
                                              })
                                            : placement2,
                                    )
                                }, []),
                            referenceRect = state.rects.reference,
                            popperRect = state.rects.popper,
                            checksMap = new Map(),
                            makeFallbackChecks = !0,
                            firstFittingPlacement = placements2[0],
                            i = 0;
                        i < placements2.length;
                        i++
                    ) {
                        var placement = placements2[i],
                            _basePlacement = getBasePlacement(placement),
                            isStartVariation =
                                getVariation(placement) === start2,
                            isVertical =
                                [top, bottom].indexOf(_basePlacement) >= 0,
                            len = isVertical ? 'width' : 'height',
                            overflow = detectOverflow(state, {
                                placement,
                                boundary,
                                rootBoundary,
                                altBoundary,
                                padding,
                            }),
                            mainVariationSide = isVertical
                                ? isStartVariation
                                    ? right
                                    : left
                                : isStartVariation
                                ? bottom
                                : top
                        referenceRect[len] > popperRect[len] &&
                            (mainVariationSide =
                                getOppositePlacement(mainVariationSide))
                        var altVariationSide =
                                getOppositePlacement(mainVariationSide),
                            checks = []
                        if (
                            (checkMainAxis &&
                                checks.push(overflow[_basePlacement] <= 0),
                            checkAltAxis &&
                                checks.push(
                                    overflow[mainVariationSide] <= 0,
                                    overflow[altVariationSide] <= 0,
                                ),
                            checks.every(function (check) {
                                return check
                            }))
                        ) {
                            ;(firstFittingPlacement = placement),
                                (makeFallbackChecks = !1)
                            break
                        }
                        checksMap.set(placement, checks)
                    }
                    if (makeFallbackChecks)
                        for (
                            var numberOfChecks = flipVariations ? 3 : 1,
                                _loop = function (_i2) {
                                    var fittingPlacement = placements2.find(
                                        function (placement2) {
                                            var checks2 =
                                                checksMap.get(placement2)
                                            if (checks2)
                                                return checks2
                                                    .slice(0, _i2)
                                                    .every(function (check) {
                                                        return check
                                                    })
                                        },
                                    )
                                    if (fittingPlacement)
                                        return (
                                            (firstFittingPlacement =
                                                fittingPlacement),
                                            'break'
                                        )
                                },
                                _i = numberOfChecks;
                            _i > 0;
                            _i--
                        ) {
                            var _ret = _loop(_i)
                            if (_ret === 'break') break
                        }
                    state.placement !== firstFittingPlacement &&
                        ((state.modifiersData[name]._skip = !0),
                        (state.placement = firstFittingPlacement),
                        (state.reset = !0))
                }
            }
            var flip$1 = {
                name: 'flip',
                enabled: !0,
                phase: 'main',
                fn: flip,
                requiresIfExists: ['offset'],
                data: { _skip: !1 },
            }
            function getAltAxis(axis) {
                return axis === 'x' ? 'y' : 'x'
            }
            function within(min$1, value, max$1) {
                return max(min$1, min(value, max$1))
            }
            function preventOverflow(_ref) {
                var state = _ref.state,
                    options = _ref.options,
                    name = _ref.name,
                    _options$mainAxis = options.mainAxis,
                    checkMainAxis =
                        _options$mainAxis === void 0 ? !0 : _options$mainAxis,
                    _options$altAxis = options.altAxis,
                    checkAltAxis =
                        _options$altAxis === void 0 ? !1 : _options$altAxis,
                    boundary = options.boundary,
                    rootBoundary = options.rootBoundary,
                    altBoundary = options.altBoundary,
                    padding = options.padding,
                    _options$tether = options.tether,
                    tether = _options$tether === void 0 ? !0 : _options$tether,
                    _options$tetherOffset = options.tetherOffset,
                    tetherOffset =
                        _options$tetherOffset === void 0
                            ? 0
                            : _options$tetherOffset,
                    overflow = detectOverflow(state, {
                        boundary,
                        rootBoundary,
                        padding,
                        altBoundary,
                    }),
                    basePlacement = getBasePlacement(state.placement),
                    variation = getVariation(state.placement),
                    isBasePlacement = !variation,
                    mainAxis = getMainAxisFromPlacement(basePlacement),
                    altAxis = getAltAxis(mainAxis),
                    popperOffsets2 = state.modifiersData.popperOffsets,
                    referenceRect = state.rects.reference,
                    popperRect = state.rects.popper,
                    tetherOffsetValue =
                        typeof tetherOffset == 'function'
                            ? tetherOffset(
                                  Object.assign({}, state.rects, {
                                      placement: state.placement,
                                  }),
                              )
                            : tetherOffset,
                    data2 = { x: 0, y: 0 }
                if (!!popperOffsets2) {
                    if (checkMainAxis || checkAltAxis) {
                        var mainSide = mainAxis === 'y' ? top : left,
                            altSide = mainAxis === 'y' ? bottom : right,
                            len = mainAxis === 'y' ? 'height' : 'width',
                            offset2 = popperOffsets2[mainAxis],
                            min$1 =
                                popperOffsets2[mainAxis] + overflow[mainSide],
                            max$1 =
                                popperOffsets2[mainAxis] - overflow[altSide],
                            additive = tether ? -popperRect[len] / 2 : 0,
                            minLen =
                                variation === start2
                                    ? referenceRect[len]
                                    : popperRect[len],
                            maxLen =
                                variation === start2
                                    ? -popperRect[len]
                                    : -referenceRect[len],
                            arrowElement = state.elements.arrow,
                            arrowRect =
                                tether && arrowElement
                                    ? getLayoutRect(arrowElement)
                                    : { width: 0, height: 0 },
                            arrowPaddingObject = state.modifiersData[
                                'arrow#persistent'
                            ]
                                ? state.modifiersData['arrow#persistent']
                                      .padding
                                : getFreshSideObject(),
                            arrowPaddingMin = arrowPaddingObject[mainSide],
                            arrowPaddingMax = arrowPaddingObject[altSide],
                            arrowLen = within(
                                0,
                                referenceRect[len],
                                arrowRect[len],
                            ),
                            minOffset = isBasePlacement
                                ? referenceRect[len] / 2 -
                                  additive -
                                  arrowLen -
                                  arrowPaddingMin -
                                  tetherOffsetValue
                                : minLen -
                                  arrowLen -
                                  arrowPaddingMin -
                                  tetherOffsetValue,
                            maxOffset = isBasePlacement
                                ? -referenceRect[len] / 2 +
                                  additive +
                                  arrowLen +
                                  arrowPaddingMax +
                                  tetherOffsetValue
                                : maxLen +
                                  arrowLen +
                                  arrowPaddingMax +
                                  tetherOffsetValue,
                            arrowOffsetParent =
                                state.elements.arrow &&
                                getOffsetParent(state.elements.arrow),
                            clientOffset = arrowOffsetParent
                                ? mainAxis === 'y'
                                    ? arrowOffsetParent.clientTop || 0
                                    : arrowOffsetParent.clientLeft || 0
                                : 0,
                            offsetModifierValue = state.modifiersData.offset
                                ? state.modifiersData.offset[state.placement][
                                      mainAxis
                                  ]
                                : 0,
                            tetherMin =
                                popperOffsets2[mainAxis] +
                                minOffset -
                                offsetModifierValue -
                                clientOffset,
                            tetherMax =
                                popperOffsets2[mainAxis] +
                                maxOffset -
                                offsetModifierValue
                        if (checkMainAxis) {
                            var preventedOffset = within(
                                tether ? min(min$1, tetherMin) : min$1,
                                offset2,
                                tether ? max(max$1, tetherMax) : max$1,
                            )
                            ;(popperOffsets2[mainAxis] = preventedOffset),
                                (data2[mainAxis] = preventedOffset - offset2)
                        }
                        if (checkAltAxis) {
                            var _mainSide = mainAxis === 'x' ? top : left,
                                _altSide = mainAxis === 'x' ? bottom : right,
                                _offset = popperOffsets2[altAxis],
                                _min = _offset + overflow[_mainSide],
                                _max = _offset - overflow[_altSide],
                                _preventedOffset = within(
                                    tether ? min(_min, tetherMin) : _min,
                                    _offset,
                                    tether ? max(_max, tetherMax) : _max,
                                )
                            ;(popperOffsets2[altAxis] = _preventedOffset),
                                (data2[altAxis] = _preventedOffset - _offset)
                        }
                    }
                    state.modifiersData[name] = data2
                }
            }
            var preventOverflow$1 = {
                    name: 'preventOverflow',
                    enabled: !0,
                    phase: 'main',
                    fn: preventOverflow,
                    requiresIfExists: ['offset'],
                },
                toPaddingObject = function (padding, state) {
                    return (
                        (padding =
                            typeof padding == 'function'
                                ? padding(
                                      Object.assign({}, state.rects, {
                                          placement: state.placement,
                                      }),
                                  )
                                : padding),
                        mergePaddingObject(
                            typeof padding != 'number'
                                ? padding
                                : expandToHashMap(padding, basePlacements),
                        )
                    )
                }
            function arrow(_ref) {
                var _state$modifiersData$,
                    state = _ref.state,
                    name = _ref.name,
                    options = _ref.options,
                    arrowElement = state.elements.arrow,
                    popperOffsets2 = state.modifiersData.popperOffsets,
                    basePlacement = getBasePlacement(state.placement),
                    axis = getMainAxisFromPlacement(basePlacement),
                    isVertical = [left, right].indexOf(basePlacement) >= 0,
                    len = isVertical ? 'height' : 'width'
                if (!(!arrowElement || !popperOffsets2)) {
                    var paddingObject = toPaddingObject(options.padding, state),
                        arrowRect = getLayoutRect(arrowElement),
                        minProp = axis === 'y' ? top : left,
                        maxProp = axis === 'y' ? bottom : right,
                        endDiff =
                            state.rects.reference[len] +
                            state.rects.reference[axis] -
                            popperOffsets2[axis] -
                            state.rects.popper[len],
                        startDiff =
                            popperOffsets2[axis] - state.rects.reference[axis],
                        arrowOffsetParent = getOffsetParent(arrowElement),
                        clientSize = arrowOffsetParent
                            ? axis === 'y'
                                ? arrowOffsetParent.clientHeight || 0
                                : arrowOffsetParent.clientWidth || 0
                            : 0,
                        centerToReference = endDiff / 2 - startDiff / 2,
                        min2 = paddingObject[minProp],
                        max2 =
                            clientSize -
                            arrowRect[len] -
                            paddingObject[maxProp],
                        center =
                            clientSize / 2 -
                            arrowRect[len] / 2 +
                            centerToReference,
                        offset2 = within(min2, center, max2),
                        axisProp = axis
                    state.modifiersData[name] =
                        ((_state$modifiersData$ = {}),
                        (_state$modifiersData$[axisProp] = offset2),
                        (_state$modifiersData$.centerOffset = offset2 - center),
                        _state$modifiersData$)
                }
            }
            function effect3(_ref2) {
                var state = _ref2.state,
                    options = _ref2.options,
                    _options$element = options.element,
                    arrowElement =
                        _options$element === void 0
                            ? '[data-popper-arrow]'
                            : _options$element
                if (
                    arrowElement != null &&
                    !(
                        typeof arrowElement == 'string' &&
                        ((arrowElement =
                            state.elements.popper.querySelector(arrowElement)),
                        !arrowElement)
                    )
                ) {
                    if (
                        (isHTMLElement(arrowElement) ||
                            console.error(
                                [
                                    'Popper: "arrow" element must be an HTMLElement (not an SVGElement).',
                                    'To use an SVG arrow, wrap it in an HTMLElement that will be used as',
                                    'the arrow.',
                                ].join(' '),
                            ),
                        !contains(state.elements.popper, arrowElement))
                    ) {
                        console.error(
                            [
                                'Popper: "arrow" modifier\'s `element` must be a child of the popper',
                                'element.',
                            ].join(' '),
                        )
                        return
                    }
                    state.elements.arrow = arrowElement
                }
            }
            var arrow$1 = {
                name: 'arrow',
                enabled: !0,
                phase: 'main',
                fn: arrow,
                effect: effect3,
                requires: ['popperOffsets'],
                requiresIfExists: ['preventOverflow'],
            }
            function getSideOffsets(overflow, rect, preventedOffsets) {
                return (
                    preventedOffsets === void 0 &&
                        (preventedOffsets = { x: 0, y: 0 }),
                    {
                        top: overflow.top - rect.height - preventedOffsets.y,
                        right: overflow.right - rect.width + preventedOffsets.x,
                        bottom:
                            overflow.bottom - rect.height + preventedOffsets.y,
                        left: overflow.left - rect.width - preventedOffsets.x,
                    }
                )
            }
            function isAnySideFullyClipped(overflow) {
                return [top, right, bottom, left].some(function (side) {
                    return overflow[side] >= 0
                })
            }
            function hide(_ref) {
                var state = _ref.state,
                    name = _ref.name,
                    referenceRect = state.rects.reference,
                    popperRect = state.rects.popper,
                    preventedOffsets = state.modifiersData.preventOverflow,
                    referenceOverflow = detectOverflow(state, {
                        elementContext: 'reference',
                    }),
                    popperAltOverflow = detectOverflow(state, {
                        altBoundary: !0,
                    }),
                    referenceClippingOffsets = getSideOffsets(
                        referenceOverflow,
                        referenceRect,
                    ),
                    popperEscapeOffsets = getSideOffsets(
                        popperAltOverflow,
                        popperRect,
                        preventedOffsets,
                    ),
                    isReferenceHidden = isAnySideFullyClipped(
                        referenceClippingOffsets,
                    ),
                    hasPopperEscaped =
                        isAnySideFullyClipped(popperEscapeOffsets)
                ;(state.modifiersData[name] = {
                    referenceClippingOffsets,
                    popperEscapeOffsets,
                    isReferenceHidden,
                    hasPopperEscaped,
                }),
                    (state.attributes.popper = Object.assign(
                        {},
                        state.attributes.popper,
                        {
                            'data-popper-reference-hidden': isReferenceHidden,
                            'data-popper-escaped': hasPopperEscaped,
                        },
                    ))
            }
            var hide$1 = {
                    name: 'hide',
                    enabled: !0,
                    phase: 'main',
                    requiresIfExists: ['preventOverflow'],
                    fn: hide,
                },
                defaultModifiers$1 = [
                    eventListeners,
                    popperOffsets$1,
                    computeStyles$1,
                    applyStyles$1,
                ],
                createPopper$1 = popperGenerator({
                    defaultModifiers: defaultModifiers$1,
                }),
                defaultModifiers = [
                    eventListeners,
                    popperOffsets$1,
                    computeStyles$1,
                    applyStyles$1,
                    offset$1,
                    flip$1,
                    preventOverflow$1,
                    arrow$1,
                    hide$1,
                ],
                createPopper = popperGenerator({ defaultModifiers })
            ;(exports.applyStyles = applyStyles$1),
                (exports.arrow = arrow$1),
                (exports.computeStyles = computeStyles$1),
                (exports.createPopper = createPopper),
                (exports.createPopperLite = createPopper$1),
                (exports.defaultModifiers = defaultModifiers),
                (exports.detectOverflow = detectOverflow),
                (exports.eventListeners = eventListeners),
                (exports.flip = flip$1),
                (exports.hide = hide$1),
                (exports.offset = offset$1),
                (exports.popperGenerator = popperGenerator),
                (exports.popperOffsets = popperOffsets$1),
                (exports.preventOverflow = preventOverflow$1)
        }),
        require_tippy_cjs = __commonJS2((exports) => {
            'use strict'
            Object.defineProperty(exports, '__esModule', { value: !0 })
            var core = require_popper(),
                ROUND_ARROW =
                    '<svg width="16" height="6" xmlns="http://www.w3.org/2000/svg"><path d="M0 6s1.796-.013 4.67-3.615C5.851.9 6.93.006 8 0c1.07-.006 2.148.887 3.343 2.385C14.233 6.005 16 6 16 6H0z"></svg>',
                BOX_CLASS = 'tippy-box',
                CONTENT_CLASS = 'tippy-content',
                BACKDROP_CLASS = 'tippy-backdrop',
                ARROW_CLASS = 'tippy-arrow',
                SVG_ARROW_CLASS = 'tippy-svg-arrow',
                TOUCH_OPTIONS = { passive: !0, capture: !0 }
            function hasOwnProperty2(obj, key) {
                return {}.hasOwnProperty.call(obj, key)
            }
            function getValueAtIndexOrReturn(value, index, defaultValue) {
                if (Array.isArray(value)) {
                    var v = value[index]
                    return (
                        v ??
                        (Array.isArray(defaultValue)
                            ? defaultValue[index]
                            : defaultValue)
                    )
                }
                return value
            }
            function isType(value, type) {
                var str = {}.toString.call(value)
                return (
                    str.indexOf('[object') === 0 && str.indexOf(type + ']') > -1
                )
            }
            function invokeWithArgsOrReturn(value, args) {
                return typeof value == 'function'
                    ? value.apply(void 0, args)
                    : value
            }
            function debounce2(fn, ms) {
                if (ms === 0) return fn
                var timeout
                return function (arg) {
                    clearTimeout(timeout),
                        (timeout = setTimeout(function () {
                            fn(arg)
                        }, ms))
                }
            }
            function removeProperties(obj, keys) {
                var clone2 = Object.assign({}, obj)
                return (
                    keys.forEach(function (key) {
                        delete clone2[key]
                    }),
                    clone2
                )
            }
            function splitBySpaces(value) {
                return value.split(/\s+/).filter(Boolean)
            }
            function normalizeToArray(value) {
                return [].concat(value)
            }
            function pushIfUnique(arr, value) {
                arr.indexOf(value) === -1 && arr.push(value)
            }
            function unique(arr) {
                return arr.filter(function (item, index) {
                    return arr.indexOf(item) === index
                })
            }
            function getBasePlacement(placement) {
                return placement.split('-')[0]
            }
            function arrayFrom(value) {
                return [].slice.call(value)
            }
            function removeUndefinedProps(obj) {
                return Object.keys(obj).reduce(function (acc, key) {
                    return obj[key] !== void 0 && (acc[key] = obj[key]), acc
                }, {})
            }
            function div() {
                return document.createElement('div')
            }
            function isElement(value) {
                return ['Element', 'Fragment'].some(function (type) {
                    return isType(value, type)
                })
            }
            function isNodeList(value) {
                return isType(value, 'NodeList')
            }
            function isMouseEvent(value) {
                return isType(value, 'MouseEvent')
            }
            function isReferenceElement(value) {
                return !!(
                    value &&
                    value._tippy &&
                    value._tippy.reference === value
                )
            }
            function getArrayOfElements(value) {
                return isElement(value)
                    ? [value]
                    : isNodeList(value)
                    ? arrayFrom(value)
                    : Array.isArray(value)
                    ? value
                    : arrayFrom(document.querySelectorAll(value))
            }
            function setTransitionDuration(els, value) {
                els.forEach(function (el) {
                    el && (el.style.transitionDuration = value + 'ms')
                })
            }
            function setVisibilityState(els, state) {
                els.forEach(function (el) {
                    el && el.setAttribute('data-state', state)
                })
            }
            function getOwnerDocument(elementOrElements) {
                var _element$ownerDocumen,
                    _normalizeToArray = normalizeToArray(elementOrElements),
                    element = _normalizeToArray[0]
                return (
                    element == null ||
                    (_element$ownerDocumen = element.ownerDocument) == null
                        ? void 0
                        : _element$ownerDocumen.body
                )
                    ? element.ownerDocument
                    : document
            }
            function isCursorOutsideInteractiveBorder(popperTreeData, event) {
                var clientX = event.clientX,
                    clientY = event.clientY
                return popperTreeData.every(function (_ref) {
                    var popperRect = _ref.popperRect,
                        popperState = _ref.popperState,
                        props = _ref.props,
                        interactiveBorder = props.interactiveBorder,
                        basePlacement = getBasePlacement(popperState.placement),
                        offsetData = popperState.modifiersData.offset
                    if (!offsetData) return !0
                    var topDistance =
                            basePlacement === 'bottom' ? offsetData.top.y : 0,
                        bottomDistance =
                            basePlacement === 'top' ? offsetData.bottom.y : 0,
                        leftDistance =
                            basePlacement === 'right' ? offsetData.left.x : 0,
                        rightDistance =
                            basePlacement === 'left' ? offsetData.right.x : 0,
                        exceedsTop =
                            popperRect.top - clientY + topDistance >
                            interactiveBorder,
                        exceedsBottom =
                            clientY - popperRect.bottom - bottomDistance >
                            interactiveBorder,
                        exceedsLeft =
                            popperRect.left - clientX + leftDistance >
                            interactiveBorder,
                        exceedsRight =
                            clientX - popperRect.right - rightDistance >
                            interactiveBorder
                    return (
                        exceedsTop ||
                        exceedsBottom ||
                        exceedsLeft ||
                        exceedsRight
                    )
                })
            }
            function updateTransitionEndListener(box, action, listener) {
                var method = action + 'EventListener'
                ;['transitionend', 'webkitTransitionEnd'].forEach(function (
                    event,
                ) {
                    box[method](event, listener)
                })
            }
            var currentInput = { isTouch: !1 },
                lastMouseMoveTime = 0
            function onDocumentTouchStart() {
                currentInput.isTouch ||
                    ((currentInput.isTouch = !0),
                    window.performance &&
                        document.addEventListener(
                            'mousemove',
                            onDocumentMouseMove,
                        ))
            }
            function onDocumentMouseMove() {
                var now = performance.now()
                now - lastMouseMoveTime < 20 &&
                    ((currentInput.isTouch = !1),
                    document.removeEventListener(
                        'mousemove',
                        onDocumentMouseMove,
                    )),
                    (lastMouseMoveTime = now)
            }
            function onWindowBlur() {
                var activeElement = document.activeElement
                if (isReferenceElement(activeElement)) {
                    var instance = activeElement._tippy
                    activeElement.blur &&
                        !instance.state.isVisible &&
                        activeElement.blur()
                }
            }
            function bindGlobalEventListeners() {
                document.addEventListener(
                    'touchstart',
                    onDocumentTouchStart,
                    TOUCH_OPTIONS,
                ),
                    window.addEventListener('blur', onWindowBlur)
            }
            var isBrowser =
                    typeof window != 'undefined' &&
                    typeof document != 'undefined',
                ua = isBrowser ? navigator.userAgent : '',
                isIE = /MSIE |Trident\//.test(ua)
            function createMemoryLeakWarning(method) {
                var txt = method === 'destroy' ? 'n already-' : ' '
                return [
                    method +
                        '() was called on a' +
                        txt +
                        'destroyed instance. This is a no-op but',
                    'indicates a potential memory leak.',
                ].join(' ')
            }
            function clean(value) {
                var spacesAndTabs = /[ \t]{2,}/g,
                    lineStartWithSpaces = /^[ \t]*/gm
                return value
                    .replace(spacesAndTabs, ' ')
                    .replace(lineStartWithSpaces, '')
                    .trim()
            }
            function getDevMessage(message) {
                return clean(
                    `
  %ctippy.js

  %c` +
                        clean(message) +
                        `

  %c\u{1F477}\u200D This is a development-only message. It will be removed in production.
  `,
                )
            }
            function getFormattedMessage(message) {
                return [
                    getDevMessage(message),
                    'color: #00C584; font-size: 1.3em; font-weight: bold;',
                    'line-height: 1.5',
                    'color: #a6a095;',
                ]
            }
            var visitedMessages
            resetVisitedMessages()
            function resetVisitedMessages() {
                visitedMessages = new Set()
            }
            function warnWhen(condition, message) {
                if (condition && !visitedMessages.has(message)) {
                    var _console
                    visitedMessages.add(message),
                        (_console = console).warn.apply(
                            _console,
                            getFormattedMessage(message),
                        )
                }
            }
            function errorWhen(condition, message) {
                if (condition && !visitedMessages.has(message)) {
                    var _console2
                    visitedMessages.add(message),
                        (_console2 = console).error.apply(
                            _console2,
                            getFormattedMessage(message),
                        )
                }
            }
            function validateTargets(targets) {
                var didPassFalsyValue = !targets,
                    didPassPlainObject =
                        Object.prototype.toString.call(targets) ===
                            '[object Object]' && !targets.addEventListener
                errorWhen(
                    didPassFalsyValue,
                    [
                        'tippy() was passed',
                        '`' + String(targets) + '`',
                        'as its targets (first) argument. Valid types are: String, Element,',
                        'Element[], or NodeList.',
                    ].join(' '),
                ),
                    errorWhen(
                        didPassPlainObject,
                        [
                            'tippy() was passed a plain object which is not supported as an argument',
                            'for virtual positioning. Use props.getReferenceClientRect instead.',
                        ].join(' '),
                    )
            }
            var pluginProps = {
                    animateFill: !1,
                    followCursor: !1,
                    inlinePositioning: !1,
                    sticky: !1,
                },
                renderProps = {
                    allowHTML: !1,
                    animation: 'fade',
                    arrow: !0,
                    content: '',
                    inertia: !1,
                    maxWidth: 350,
                    role: 'tooltip',
                    theme: '',
                    zIndex: 9999,
                },
                defaultProps = Object.assign(
                    {
                        appendTo: function () {
                            return document.body
                        },
                        aria: { content: 'auto', expanded: 'auto' },
                        delay: 0,
                        duration: [300, 250],
                        getReferenceClientRect: null,
                        hideOnClick: !0,
                        ignoreAttributes: !1,
                        interactive: !1,
                        interactiveBorder: 2,
                        interactiveDebounce: 0,
                        moveTransition: '',
                        offset: [0, 10],
                        onAfterUpdate: function () {},
                        onBeforeUpdate: function () {},
                        onCreate: function () {},
                        onDestroy: function () {},
                        onHidden: function () {},
                        onHide: function () {},
                        onMount: function () {},
                        onShow: function () {},
                        onShown: function () {},
                        onTrigger: function () {},
                        onUntrigger: function () {},
                        onClickOutside: function () {},
                        placement: 'top',
                        plugins: [],
                        popperOptions: {},
                        render: null,
                        showOnCreate: !1,
                        touch: !0,
                        trigger: 'mouseenter focus',
                        triggerTarget: null,
                    },
                    pluginProps,
                    {},
                    renderProps,
                ),
                defaultKeys = Object.keys(defaultProps),
                setDefaultProps = function (partialProps) {
                    validateProps(partialProps, [])
                    var keys = Object.keys(partialProps)
                    keys.forEach(function (key) {
                        defaultProps[key] = partialProps[key]
                    })
                }
            function getExtendedPassedProps(passedProps) {
                var plugins = passedProps.plugins || [],
                    pluginProps2 = plugins.reduce(function (acc, plugin2) {
                        var name = plugin2.name,
                            defaultValue = plugin2.defaultValue
                        return (
                            name &&
                                (acc[name] =
                                    passedProps[name] !== void 0
                                        ? passedProps[name]
                                        : defaultValue),
                            acc
                        )
                    }, {})
                return Object.assign({}, passedProps, {}, pluginProps2)
            }
            function getDataAttributeProps(reference, plugins) {
                var propKeys = plugins
                        ? Object.keys(
                              getExtendedPassedProps(
                                  Object.assign({}, defaultProps, { plugins }),
                              ),
                          )
                        : defaultKeys,
                    props = propKeys.reduce(function (acc, key) {
                        var valueAsString = (
                            reference.getAttribute('data-tippy-' + key) || ''
                        ).trim()
                        if (!valueAsString) return acc
                        if (key === 'content') acc[key] = valueAsString
                        else
                            try {
                                acc[key] = JSON.parse(valueAsString)
                            } catch (e) {
                                acc[key] = valueAsString
                            }
                        return acc
                    }, {})
                return props
            }
            function evaluateProps(reference, props) {
                var out = Object.assign(
                    {},
                    props,
                    {
                        content: invokeWithArgsOrReturn(props.content, [
                            reference,
                        ]),
                    },
                    props.ignoreAttributes
                        ? {}
                        : getDataAttributeProps(reference, props.plugins),
                )
                return (
                    (out.aria = Object.assign(
                        {},
                        defaultProps.aria,
                        {},
                        out.aria,
                    )),
                    (out.aria = {
                        expanded:
                            out.aria.expanded === 'auto'
                                ? props.interactive
                                : out.aria.expanded,
                        content:
                            out.aria.content === 'auto'
                                ? props.interactive
                                    ? null
                                    : 'describedby'
                                : out.aria.content,
                    }),
                    out
                )
            }
            function validateProps(partialProps, plugins) {
                partialProps === void 0 && (partialProps = {}),
                    plugins === void 0 && (plugins = [])
                var keys = Object.keys(partialProps)
                keys.forEach(function (prop) {
                    var nonPluginProps = removeProperties(
                            defaultProps,
                            Object.keys(pluginProps),
                        ),
                        didPassUnknownProp = !hasOwnProperty2(
                            nonPluginProps,
                            prop,
                        )
                    didPassUnknownProp &&
                        (didPassUnknownProp =
                            plugins.filter(function (plugin2) {
                                return plugin2.name === prop
                            }).length === 0),
                        warnWhen(
                            didPassUnknownProp,
                            [
                                '`' + prop + '`',
                                "is not a valid prop. You may have spelled it incorrectly, or if it's",
                                'a plugin, forgot to pass it in an array as props.plugins.',
                                `

`,
                                `All props: https://atomiks.github.io/tippyjs/v6/all-props/
`,
                                'Plugins: https://atomiks.github.io/tippyjs/v6/plugins/',
                            ].join(' '),
                        )
                })
            }
            var innerHTML = function () {
                return 'innerHTML'
            }
            function dangerouslySetInnerHTML(element, html) {
                element[innerHTML()] = html
            }
            function createArrowElement(value) {
                var arrow = div()
                return (
                    value === !0
                        ? (arrow.className = ARROW_CLASS)
                        : ((arrow.className = SVG_ARROW_CLASS),
                          isElement(value)
                              ? arrow.appendChild(value)
                              : dangerouslySetInnerHTML(arrow, value)),
                    arrow
                )
            }
            function setContent(content, props) {
                isElement(props.content)
                    ? (dangerouslySetInnerHTML(content, ''),
                      content.appendChild(props.content))
                    : typeof props.content != 'function' &&
                      (props.allowHTML
                          ? dangerouslySetInnerHTML(content, props.content)
                          : (content.textContent = props.content))
            }
            function getChildren(popper) {
                var box = popper.firstElementChild,
                    boxChildren = arrayFrom(box.children)
                return {
                    box,
                    content: boxChildren.find(function (node) {
                        return node.classList.contains(CONTENT_CLASS)
                    }),
                    arrow: boxChildren.find(function (node) {
                        return (
                            node.classList.contains(ARROW_CLASS) ||
                            node.classList.contains(SVG_ARROW_CLASS)
                        )
                    }),
                    backdrop: boxChildren.find(function (node) {
                        return node.classList.contains(BACKDROP_CLASS)
                    }),
                }
            }
            function render(instance) {
                var popper = div(),
                    box = div()
                ;(box.className = BOX_CLASS),
                    box.setAttribute('data-state', 'hidden'),
                    box.setAttribute('tabindex', '-1')
                var content = div()
                ;(content.className = CONTENT_CLASS),
                    content.setAttribute('data-state', 'hidden'),
                    setContent(content, instance.props),
                    popper.appendChild(box),
                    box.appendChild(content),
                    onUpdate(instance.props, instance.props)
                function onUpdate(prevProps, nextProps) {
                    var _getChildren = getChildren(popper),
                        box2 = _getChildren.box,
                        content2 = _getChildren.content,
                        arrow = _getChildren.arrow
                    nextProps.theme
                        ? box2.setAttribute('data-theme', nextProps.theme)
                        : box2.removeAttribute('data-theme'),
                        typeof nextProps.animation == 'string'
                            ? box2.setAttribute(
                                  'data-animation',
                                  nextProps.animation,
                              )
                            : box2.removeAttribute('data-animation'),
                        nextProps.inertia
                            ? box2.setAttribute('data-inertia', '')
                            : box2.removeAttribute('data-inertia'),
                        (box2.style.maxWidth =
                            typeof nextProps.maxWidth == 'number'
                                ? nextProps.maxWidth + 'px'
                                : nextProps.maxWidth),
                        nextProps.role
                            ? box2.setAttribute('role', nextProps.role)
                            : box2.removeAttribute('role'),
                        (prevProps.content !== nextProps.content ||
                            prevProps.allowHTML !== nextProps.allowHTML) &&
                            setContent(content2, instance.props),
                        nextProps.arrow
                            ? arrow
                                ? prevProps.arrow !== nextProps.arrow &&
                                  (box2.removeChild(arrow),
                                  box2.appendChild(
                                      createArrowElement(nextProps.arrow),
                                  ))
                                : box2.appendChild(
                                      createArrowElement(nextProps.arrow),
                                  )
                            : arrow && box2.removeChild(arrow)
                }
                return { popper, onUpdate }
            }
            render.$$tippy = !0
            var idCounter = 1,
                mouseMoveListeners = [],
                mountedInstances = []
            function createTippy(reference, passedProps) {
                var props = evaluateProps(
                        reference,
                        Object.assign(
                            {},
                            defaultProps,
                            {},
                            getExtendedPassedProps(
                                removeUndefinedProps(passedProps),
                            ),
                        ),
                    ),
                    showTimeout,
                    hideTimeout,
                    scheduleHideAnimationFrame,
                    isVisibleFromClick = !1,
                    didHideDueToDocumentMouseDown = !1,
                    didTouchMove = !1,
                    ignoreOnFirstUpdate = !1,
                    lastTriggerEvent,
                    currentTransitionEndListener,
                    onFirstUpdate,
                    listeners = [],
                    debouncedOnMouseMove = debounce2(
                        onMouseMove,
                        props.interactiveDebounce,
                    ),
                    currentTarget,
                    id = idCounter++,
                    popperInstance = null,
                    plugins = unique(props.plugins),
                    state = {
                        isEnabled: !0,
                        isVisible: !1,
                        isDestroyed: !1,
                        isMounted: !1,
                        isShown: !1,
                    },
                    instance = {
                        id,
                        reference,
                        popper: div(),
                        popperInstance,
                        props,
                        state,
                        plugins,
                        clearDelayTimeouts,
                        setProps,
                        setContent: setContent2,
                        show,
                        hide,
                        hideWithInteractivity,
                        enable,
                        disable,
                        unmount,
                        destroy,
                    }
                if (!props.render)
                    return (
                        errorWhen(
                            !0,
                            'render() function has not been supplied.',
                        ),
                        instance
                    )
                var _props$render = props.render(instance),
                    popper = _props$render.popper,
                    onUpdate = _props$render.onUpdate
                popper.setAttribute('data-tippy-root', ''),
                    (popper.id = 'tippy-' + instance.id),
                    (instance.popper = popper),
                    (reference._tippy = instance),
                    (popper._tippy = instance)
                var pluginsHooks = plugins.map(function (plugin2) {
                        return plugin2.fn(instance)
                    }),
                    hasAriaExpanded = reference.hasAttribute('aria-expanded')
                return (
                    addListeners(),
                    handleAriaExpandedAttribute(),
                    handleStyles(),
                    invokeHook('onCreate', [instance]),
                    props.showOnCreate && scheduleShow(),
                    popper.addEventListener('mouseenter', function () {
                        instance.props.interactive &&
                            instance.state.isVisible &&
                            instance.clearDelayTimeouts()
                    }),
                    popper.addEventListener('mouseleave', function (event) {
                        instance.props.interactive &&
                            instance.props.trigger.indexOf('mouseenter') >= 0 &&
                            (getDocument().addEventListener(
                                'mousemove',
                                debouncedOnMouseMove,
                            ),
                            debouncedOnMouseMove(event))
                    }),
                    instance
                )
                function getNormalizedTouchSettings() {
                    var touch = instance.props.touch
                    return Array.isArray(touch) ? touch : [touch, 0]
                }
                function getIsCustomTouchBehavior() {
                    return getNormalizedTouchSettings()[0] === 'hold'
                }
                function getIsDefaultRenderFn() {
                    var _instance$props$rende
                    return !!((_instance$props$rende = instance.props.render) ==
                    null
                        ? void 0
                        : _instance$props$rende.$$tippy)
                }
                function getCurrentTarget() {
                    return currentTarget || reference
                }
                function getDocument() {
                    var parent = getCurrentTarget().parentNode
                    return parent ? getOwnerDocument(parent) : document
                }
                function getDefaultTemplateChildren() {
                    return getChildren(popper)
                }
                function getDelay(isShow) {
                    return (instance.state.isMounted &&
                        !instance.state.isVisible) ||
                        currentInput.isTouch ||
                        (lastTriggerEvent && lastTriggerEvent.type === 'focus')
                        ? 0
                        : getValueAtIndexOrReturn(
                              instance.props.delay,
                              isShow ? 0 : 1,
                              defaultProps.delay,
                          )
                }
                function handleStyles() {
                    ;(popper.style.pointerEvents =
                        instance.props.interactive && instance.state.isVisible
                            ? ''
                            : 'none'),
                        (popper.style.zIndex = '' + instance.props.zIndex)
                }
                function invokeHook(hook, args, shouldInvokePropsHook) {
                    if (
                        (shouldInvokePropsHook === void 0 &&
                            (shouldInvokePropsHook = !0),
                        pluginsHooks.forEach(function (pluginHooks) {
                            pluginHooks[hook] &&
                                pluginHooks[hook].apply(void 0, args)
                        }),
                        shouldInvokePropsHook)
                    ) {
                        var _instance$props
                        ;(_instance$props = instance.props)[hook].apply(
                            _instance$props,
                            args,
                        )
                    }
                }
                function handleAriaContentAttribute() {
                    var aria = instance.props.aria
                    if (!!aria.content) {
                        var attr = 'aria-' + aria.content,
                            id2 = popper.id,
                            nodes = normalizeToArray(
                                instance.props.triggerTarget || reference,
                            )
                        nodes.forEach(function (node) {
                            var currentValue = node.getAttribute(attr)
                            if (instance.state.isVisible)
                                node.setAttribute(
                                    attr,
                                    currentValue
                                        ? currentValue + ' ' + id2
                                        : id2,
                                )
                            else {
                                var nextValue =
                                    currentValue &&
                                    currentValue.replace(id2, '').trim()
                                nextValue
                                    ? node.setAttribute(attr, nextValue)
                                    : node.removeAttribute(attr)
                            }
                        })
                    }
                }
                function handleAriaExpandedAttribute() {
                    if (!(hasAriaExpanded || !instance.props.aria.expanded)) {
                        var nodes = normalizeToArray(
                            instance.props.triggerTarget || reference,
                        )
                        nodes.forEach(function (node) {
                            instance.props.interactive
                                ? node.setAttribute(
                                      'aria-expanded',
                                      instance.state.isVisible &&
                                          node === getCurrentTarget()
                                          ? 'true'
                                          : 'false',
                                  )
                                : node.removeAttribute('aria-expanded')
                        })
                    }
                }
                function cleanupInteractiveMouseListeners() {
                    getDocument().removeEventListener(
                        'mousemove',
                        debouncedOnMouseMove,
                    ),
                        (mouseMoveListeners = mouseMoveListeners.filter(
                            function (listener) {
                                return listener !== debouncedOnMouseMove
                            },
                        ))
                }
                function onDocumentPress(event) {
                    if (
                        !(
                            currentInput.isTouch &&
                            (didTouchMove || event.type === 'mousedown')
                        ) &&
                        !(
                            instance.props.interactive &&
                            popper.contains(event.target)
                        )
                    ) {
                        if (getCurrentTarget().contains(event.target)) {
                            if (
                                currentInput.isTouch ||
                                (instance.state.isVisible &&
                                    instance.props.trigger.indexOf('click') >=
                                        0)
                            )
                                return
                        } else invokeHook('onClickOutside', [instance, event])
                        instance.props.hideOnClick === !0 &&
                            (instance.clearDelayTimeouts(),
                            instance.hide(),
                            (didHideDueToDocumentMouseDown = !0),
                            setTimeout(function () {
                                didHideDueToDocumentMouseDown = !1
                            }),
                            instance.state.isMounted || removeDocumentPress())
                    }
                }
                function onTouchMove() {
                    didTouchMove = !0
                }
                function onTouchStart() {
                    didTouchMove = !1
                }
                function addDocumentPress() {
                    var doc = getDocument()
                    doc.addEventListener('mousedown', onDocumentPress, !0),
                        doc.addEventListener(
                            'touchend',
                            onDocumentPress,
                            TOUCH_OPTIONS,
                        ),
                        doc.addEventListener(
                            'touchstart',
                            onTouchStart,
                            TOUCH_OPTIONS,
                        ),
                        doc.addEventListener(
                            'touchmove',
                            onTouchMove,
                            TOUCH_OPTIONS,
                        )
                }
                function removeDocumentPress() {
                    var doc = getDocument()
                    doc.removeEventListener('mousedown', onDocumentPress, !0),
                        doc.removeEventListener(
                            'touchend',
                            onDocumentPress,
                            TOUCH_OPTIONS,
                        ),
                        doc.removeEventListener(
                            'touchstart',
                            onTouchStart,
                            TOUCH_OPTIONS,
                        ),
                        doc.removeEventListener(
                            'touchmove',
                            onTouchMove,
                            TOUCH_OPTIONS,
                        )
                }
                function onTransitionedOut(duration, callback) {
                    onTransitionEnd(duration, function () {
                        !instance.state.isVisible &&
                            popper.parentNode &&
                            popper.parentNode.contains(popper) &&
                            callback()
                    })
                }
                function onTransitionedIn(duration, callback) {
                    onTransitionEnd(duration, callback)
                }
                function onTransitionEnd(duration, callback) {
                    var box = getDefaultTemplateChildren().box
                    function listener(event) {
                        event.target === box &&
                            (updateTransitionEndListener(
                                box,
                                'remove',
                                listener,
                            ),
                            callback())
                    }
                    if (duration === 0) return callback()
                    updateTransitionEndListener(
                        box,
                        'remove',
                        currentTransitionEndListener,
                    ),
                        updateTransitionEndListener(box, 'add', listener),
                        (currentTransitionEndListener = listener)
                }
                function on2(eventType, handler3, options) {
                    options === void 0 && (options = !1)
                    var nodes = normalizeToArray(
                        instance.props.triggerTarget || reference,
                    )
                    nodes.forEach(function (node) {
                        node.addEventListener(eventType, handler3, options),
                            listeners.push({
                                node,
                                eventType,
                                handler: handler3,
                                options,
                            })
                    })
                }
                function addListeners() {
                    getIsCustomTouchBehavior() &&
                        (on2('touchstart', onTrigger, { passive: !0 }),
                        on2('touchend', onMouseLeave, { passive: !0 })),
                        splitBySpaces(instance.props.trigger).forEach(function (
                            eventType,
                        ) {
                            if (eventType !== 'manual')
                                switch (
                                    (on2(eventType, onTrigger), eventType)
                                ) {
                                    case 'mouseenter':
                                        on2('mouseleave', onMouseLeave)
                                        break
                                    case 'focus':
                                        on2(
                                            isIE ? 'focusout' : 'blur',
                                            onBlurOrFocusOut,
                                        )
                                        break
                                    case 'focusin':
                                        on2('focusout', onBlurOrFocusOut)
                                        break
                                }
                        })
                }
                function removeListeners() {
                    listeners.forEach(function (_ref) {
                        var node = _ref.node,
                            eventType = _ref.eventType,
                            handler3 = _ref.handler,
                            options = _ref.options
                        node.removeEventListener(eventType, handler3, options)
                    }),
                        (listeners = [])
                }
                function onTrigger(event) {
                    var _lastTriggerEvent,
                        shouldScheduleClickHide = !1
                    if (
                        !(
                            !instance.state.isEnabled ||
                            isEventListenerStopped(event) ||
                            didHideDueToDocumentMouseDown
                        )
                    ) {
                        var wasFocused =
                            ((_lastTriggerEvent = lastTriggerEvent) == null
                                ? void 0
                                : _lastTriggerEvent.type) === 'focus'
                        ;(lastTriggerEvent = event),
                            (currentTarget = event.currentTarget),
                            handleAriaExpandedAttribute(),
                            !instance.state.isVisible &&
                                isMouseEvent(event) &&
                                mouseMoveListeners.forEach(function (listener) {
                                    return listener(event)
                                }),
                            event.type === 'click' &&
                            (instance.props.trigger.indexOf('mouseenter') < 0 ||
                                isVisibleFromClick) &&
                            instance.props.hideOnClick !== !1 &&
                            instance.state.isVisible
                                ? (shouldScheduleClickHide = !0)
                                : scheduleShow(event),
                            event.type === 'click' &&
                                (isVisibleFromClick = !shouldScheduleClickHide),
                            shouldScheduleClickHide &&
                                !wasFocused &&
                                scheduleHide(event)
                    }
                }
                function onMouseMove(event) {
                    var target = event.target,
                        isCursorOverReferenceOrPopper =
                            getCurrentTarget().contains(target) ||
                            popper.contains(target)
                    if (
                        !(
                            event.type === 'mousemove' &&
                            isCursorOverReferenceOrPopper
                        )
                    ) {
                        var popperTreeData = getNestedPopperTree()
                            .concat(popper)
                            .map(function (popper2) {
                                var _instance$popperInsta,
                                    instance2 = popper2._tippy,
                                    state2 =
                                        (_instance$popperInsta =
                                            instance2.popperInstance) == null
                                            ? void 0
                                            : _instance$popperInsta.state
                                return state2
                                    ? {
                                          popperRect:
                                              popper2.getBoundingClientRect(),
                                          popperState: state2,
                                          props,
                                      }
                                    : null
                            })
                            .filter(Boolean)
                        isCursorOutsideInteractiveBorder(
                            popperTreeData,
                            event,
                        ) &&
                            (cleanupInteractiveMouseListeners(),
                            scheduleHide(event))
                    }
                }
                function onMouseLeave(event) {
                    var shouldBail =
                        isEventListenerStopped(event) ||
                        (instance.props.trigger.indexOf('click') >= 0 &&
                            isVisibleFromClick)
                    if (!shouldBail) {
                        if (instance.props.interactive) {
                            instance.hideWithInteractivity(event)
                            return
                        }
                        scheduleHide(event)
                    }
                }
                function onBlurOrFocusOut(event) {
                    ;(instance.props.trigger.indexOf('focusin') < 0 &&
                        event.target !== getCurrentTarget()) ||
                        (instance.props.interactive &&
                            event.relatedTarget &&
                            popper.contains(event.relatedTarget)) ||
                        scheduleHide(event)
                }
                function isEventListenerStopped(event) {
                    return currentInput.isTouch
                        ? getIsCustomTouchBehavior() !==
                              event.type.indexOf('touch') >= 0
                        : !1
                }
                function createPopperInstance() {
                    destroyPopperInstance()
                    var _instance$props2 = instance.props,
                        popperOptions = _instance$props2.popperOptions,
                        placement = _instance$props2.placement,
                        offset = _instance$props2.offset,
                        getReferenceClientRect =
                            _instance$props2.getReferenceClientRect,
                        moveTransition = _instance$props2.moveTransition,
                        arrow = getIsDefaultRenderFn()
                            ? getChildren(popper).arrow
                            : null,
                        computedReference = getReferenceClientRect
                            ? {
                                  getBoundingClientRect: getReferenceClientRect,
                                  contextElement:
                                      getReferenceClientRect.contextElement ||
                                      getCurrentTarget(),
                              }
                            : reference,
                        tippyModifier = {
                            name: '$$tippy',
                            enabled: !0,
                            phase: 'beforeWrite',
                            requires: ['computeStyles'],
                            fn: function (_ref2) {
                                var state2 = _ref2.state
                                if (getIsDefaultRenderFn()) {
                                    var _getDefaultTemplateCh =
                                            getDefaultTemplateChildren(),
                                        box = _getDefaultTemplateCh.box
                                    ;[
                                        'placement',
                                        'reference-hidden',
                                        'escaped',
                                    ].forEach(function (attr) {
                                        attr === 'placement'
                                            ? box.setAttribute(
                                                  'data-placement',
                                                  state2.placement,
                                              )
                                            : state2.attributes.popper[
                                                  'data-popper-' + attr
                                              ]
                                            ? box.setAttribute(
                                                  'data-' + attr,
                                                  '',
                                              )
                                            : box.removeAttribute(
                                                  'data-' + attr,
                                              )
                                    }),
                                        (state2.attributes.popper = {})
                                }
                            },
                        },
                        modifiers = [
                            { name: 'offset', options: { offset } },
                            {
                                name: 'preventOverflow',
                                options: {
                                    padding: {
                                        top: 2,
                                        bottom: 2,
                                        left: 5,
                                        right: 5,
                                    },
                                },
                            },
                            { name: 'flip', options: { padding: 5 } },
                            {
                                name: 'computeStyles',
                                options: { adaptive: !moveTransition },
                            },
                            tippyModifier,
                        ]
                    getIsDefaultRenderFn() &&
                        arrow &&
                        modifiers.push({
                            name: 'arrow',
                            options: { element: arrow, padding: 3 },
                        }),
                        modifiers.push.apply(
                            modifiers,
                            (popperOptions == null
                                ? void 0
                                : popperOptions.modifiers) || [],
                        ),
                        (instance.popperInstance = core.createPopper(
                            computedReference,
                            popper,
                            Object.assign({}, popperOptions, {
                                placement,
                                onFirstUpdate,
                                modifiers,
                            }),
                        ))
                }
                function destroyPopperInstance() {
                    instance.popperInstance &&
                        (instance.popperInstance.destroy(),
                        (instance.popperInstance = null))
                }
                function mount() {
                    var appendTo = instance.props.appendTo,
                        parentNode,
                        node = getCurrentTarget()
                    ;(instance.props.interactive &&
                        appendTo === defaultProps.appendTo) ||
                    appendTo === 'parent'
                        ? (parentNode = node.parentNode)
                        : (parentNode = invokeWithArgsOrReturn(appendTo, [
                              node,
                          ])),
                        parentNode.contains(popper) ||
                            parentNode.appendChild(popper),
                        createPopperInstance(),
                        warnWhen(
                            instance.props.interactive &&
                                appendTo === defaultProps.appendTo &&
                                node.nextElementSibling !== popper,
                            [
                                'Interactive tippy element may not be accessible via keyboard',
                                'navigation because it is not directly after the reference element',
                                'in the DOM source order.',
                                `

`,
                                'Using a wrapper <div> or <span> tag around the reference element',
                                'solves this by creating a new parentNode context.',
                                `

`,
                                'Specifying `appendTo: document.body` silences this warning, but it',
                                'assumes you are using a focus management solution to handle',
                                'keyboard navigation.',
                                `

`,
                                'See: https://atomiks.github.io/tippyjs/v6/accessibility/#interactivity',
                            ].join(' '),
                        )
                }
                function getNestedPopperTree() {
                    return arrayFrom(
                        popper.querySelectorAll('[data-tippy-root]'),
                    )
                }
                function scheduleShow(event) {
                    instance.clearDelayTimeouts(),
                        event && invokeHook('onTrigger', [instance, event]),
                        addDocumentPress()
                    var delay = getDelay(!0),
                        _getNormalizedTouchSe = getNormalizedTouchSettings(),
                        touchValue = _getNormalizedTouchSe[0],
                        touchDelay = _getNormalizedTouchSe[1]
                    currentInput.isTouch &&
                        touchValue === 'hold' &&
                        touchDelay &&
                        (delay = touchDelay),
                        delay
                            ? (showTimeout = setTimeout(function () {
                                  instance.show()
                              }, delay))
                            : instance.show()
                }
                function scheduleHide(event) {
                    if (
                        (instance.clearDelayTimeouts(),
                        invokeHook('onUntrigger', [instance, event]),
                        !instance.state.isVisible)
                    ) {
                        removeDocumentPress()
                        return
                    }
                    if (
                        !(
                            instance.props.trigger.indexOf('mouseenter') >= 0 &&
                            instance.props.trigger.indexOf('click') >= 0 &&
                            ['mouseleave', 'mousemove'].indexOf(event.type) >=
                                0 &&
                            isVisibleFromClick
                        )
                    ) {
                        var delay = getDelay(!1)
                        delay
                            ? (hideTimeout = setTimeout(function () {
                                  instance.state.isVisible && instance.hide()
                              }, delay))
                            : (scheduleHideAnimationFrame =
                                  requestAnimationFrame(function () {
                                      instance.hide()
                                  }))
                    }
                }
                function enable() {
                    instance.state.isEnabled = !0
                }
                function disable() {
                    instance.hide(), (instance.state.isEnabled = !1)
                }
                function clearDelayTimeouts() {
                    clearTimeout(showTimeout),
                        clearTimeout(hideTimeout),
                        cancelAnimationFrame(scheduleHideAnimationFrame)
                }
                function setProps(partialProps) {
                    if (
                        (warnWhen(
                            instance.state.isDestroyed,
                            createMemoryLeakWarning('setProps'),
                        ),
                        !instance.state.isDestroyed)
                    ) {
                        invokeHook('onBeforeUpdate', [instance, partialProps]),
                            removeListeners()
                        var prevProps = instance.props,
                            nextProps = evaluateProps(
                                reference,
                                Object.assign(
                                    {},
                                    instance.props,
                                    {},
                                    partialProps,
                                    { ignoreAttributes: !0 },
                                ),
                            )
                        ;(instance.props = nextProps),
                            addListeners(),
                            prevProps.interactiveDebounce !==
                                nextProps.interactiveDebounce &&
                                (cleanupInteractiveMouseListeners(),
                                (debouncedOnMouseMove = debounce2(
                                    onMouseMove,
                                    nextProps.interactiveDebounce,
                                ))),
                            prevProps.triggerTarget && !nextProps.triggerTarget
                                ? normalizeToArray(
                                      prevProps.triggerTarget,
                                  ).forEach(function (node) {
                                      node.removeAttribute('aria-expanded')
                                  })
                                : nextProps.triggerTarget &&
                                  reference.removeAttribute('aria-expanded'),
                            handleAriaExpandedAttribute(),
                            handleStyles(),
                            onUpdate && onUpdate(prevProps, nextProps),
                            instance.popperInstance &&
                                (createPopperInstance(),
                                getNestedPopperTree().forEach(function (
                                    nestedPopper,
                                ) {
                                    requestAnimationFrame(
                                        nestedPopper._tippy.popperInstance
                                            .forceUpdate,
                                    )
                                })),
                            invokeHook('onAfterUpdate', [
                                instance,
                                partialProps,
                            ])
                    }
                }
                function setContent2(content) {
                    instance.setProps({ content })
                }
                function show() {
                    warnWhen(
                        instance.state.isDestroyed,
                        createMemoryLeakWarning('show'),
                    )
                    var isAlreadyVisible = instance.state.isVisible,
                        isDestroyed = instance.state.isDestroyed,
                        isDisabled = !instance.state.isEnabled,
                        isTouchAndTouchDisabled =
                            currentInput.isTouch && !instance.props.touch,
                        duration = getValueAtIndexOrReturn(
                            instance.props.duration,
                            0,
                            defaultProps.duration,
                        )
                    if (
                        !(
                            isAlreadyVisible ||
                            isDestroyed ||
                            isDisabled ||
                            isTouchAndTouchDisabled
                        ) &&
                        !getCurrentTarget().hasAttribute('disabled') &&
                        (invokeHook('onShow', [instance], !1),
                        instance.props.onShow(instance) !== !1)
                    ) {
                        if (
                            ((instance.state.isVisible = !0),
                            getIsDefaultRenderFn() &&
                                (popper.style.visibility = 'visible'),
                            handleStyles(),
                            addDocumentPress(),
                            instance.state.isMounted ||
                                (popper.style.transition = 'none'),
                            getIsDefaultRenderFn())
                        ) {
                            var _getDefaultTemplateCh2 =
                                    getDefaultTemplateChildren(),
                                box = _getDefaultTemplateCh2.box,
                                content = _getDefaultTemplateCh2.content
                            setTransitionDuration([box, content], 0)
                        }
                        ;(onFirstUpdate = function () {
                            var _instance$popperInsta2
                            if (
                                !(
                                    !instance.state.isVisible ||
                                    ignoreOnFirstUpdate
                                )
                            ) {
                                if (
                                    ((ignoreOnFirstUpdate = !0),
                                    popper.offsetHeight,
                                    (popper.style.transition =
                                        instance.props.moveTransition),
                                    getIsDefaultRenderFn() &&
                                        instance.props.animation)
                                ) {
                                    var _getDefaultTemplateCh3 =
                                            getDefaultTemplateChildren(),
                                        _box = _getDefaultTemplateCh3.box,
                                        _content =
                                            _getDefaultTemplateCh3.content
                                    setTransitionDuration(
                                        [_box, _content],
                                        duration,
                                    ),
                                        setVisibilityState(
                                            [_box, _content],
                                            'visible',
                                        )
                                }
                                handleAriaContentAttribute(),
                                    handleAriaExpandedAttribute(),
                                    pushIfUnique(mountedInstances, instance),
                                    (_instance$popperInsta2 =
                                        instance.popperInstance) == null ||
                                        _instance$popperInsta2.forceUpdate(),
                                    (instance.state.isMounted = !0),
                                    invokeHook('onMount', [instance]),
                                    instance.props.animation &&
                                        getIsDefaultRenderFn() &&
                                        onTransitionedIn(duration, function () {
                                            ;(instance.state.isShown = !0),
                                                invokeHook('onShown', [
                                                    instance,
                                                ])
                                        })
                            }
                        }),
                            mount()
                    }
                }
                function hide() {
                    warnWhen(
                        instance.state.isDestroyed,
                        createMemoryLeakWarning('hide'),
                    )
                    var isAlreadyHidden = !instance.state.isVisible,
                        isDestroyed = instance.state.isDestroyed,
                        isDisabled = !instance.state.isEnabled,
                        duration = getValueAtIndexOrReturn(
                            instance.props.duration,
                            1,
                            defaultProps.duration,
                        )
                    if (
                        !(isAlreadyHidden || isDestroyed || isDisabled) &&
                        (invokeHook('onHide', [instance], !1),
                        instance.props.onHide(instance) !== !1)
                    ) {
                        if (
                            ((instance.state.isVisible = !1),
                            (instance.state.isShown = !1),
                            (ignoreOnFirstUpdate = !1),
                            (isVisibleFromClick = !1),
                            getIsDefaultRenderFn() &&
                                (popper.style.visibility = 'hidden'),
                            cleanupInteractiveMouseListeners(),
                            removeDocumentPress(),
                            handleStyles(),
                            getIsDefaultRenderFn())
                        ) {
                            var _getDefaultTemplateCh4 =
                                    getDefaultTemplateChildren(),
                                box = _getDefaultTemplateCh4.box,
                                content = _getDefaultTemplateCh4.content
                            instance.props.animation &&
                                (setTransitionDuration(
                                    [box, content],
                                    duration,
                                ),
                                setVisibilityState([box, content], 'hidden'))
                        }
                        handleAriaContentAttribute(),
                            handleAriaExpandedAttribute(),
                            instance.props.animation
                                ? getIsDefaultRenderFn() &&
                                  onTransitionedOut(duration, instance.unmount)
                                : instance.unmount()
                    }
                }
                function hideWithInteractivity(event) {
                    warnWhen(
                        instance.state.isDestroyed,
                        createMemoryLeakWarning('hideWithInteractivity'),
                    ),
                        getDocument().addEventListener(
                            'mousemove',
                            debouncedOnMouseMove,
                        ),
                        pushIfUnique(mouseMoveListeners, debouncedOnMouseMove),
                        debouncedOnMouseMove(event)
                }
                function unmount() {
                    warnWhen(
                        instance.state.isDestroyed,
                        createMemoryLeakWarning('unmount'),
                    ),
                        instance.state.isVisible && instance.hide(),
                        !!instance.state.isMounted &&
                            (destroyPopperInstance(),
                            getNestedPopperTree().forEach(function (
                                nestedPopper,
                            ) {
                                nestedPopper._tippy.unmount()
                            }),
                            popper.parentNode &&
                                popper.parentNode.removeChild(popper),
                            (mountedInstances = mountedInstances.filter(
                                function (i) {
                                    return i !== instance
                                },
                            )),
                            (instance.state.isMounted = !1),
                            invokeHook('onHidden', [instance]))
                }
                function destroy() {
                    warnWhen(
                        instance.state.isDestroyed,
                        createMemoryLeakWarning('destroy'),
                    ),
                        !instance.state.isDestroyed &&
                            (instance.clearDelayTimeouts(),
                            instance.unmount(),
                            removeListeners(),
                            delete reference._tippy,
                            (instance.state.isDestroyed = !0),
                            invokeHook('onDestroy', [instance]))
                }
            }
            function tippy2(targets, optionalProps) {
                optionalProps === void 0 && (optionalProps = {})
                var plugins = defaultProps.plugins.concat(
                    optionalProps.plugins || [],
                )
                validateTargets(targets),
                    validateProps(optionalProps, plugins),
                    bindGlobalEventListeners()
                var passedProps = Object.assign({}, optionalProps, { plugins }),
                    elements = getArrayOfElements(targets),
                    isSingleContentElement = isElement(passedProps.content),
                    isMoreThanOneReferenceElement = elements.length > 1
                warnWhen(
                    isSingleContentElement && isMoreThanOneReferenceElement,
                    [
                        'tippy() was passed an Element as the `content` prop, but more than',
                        'one tippy instance was created by this invocation. This means the',
                        'content element will only be appended to the last tippy instance.',
                        `

`,
                        'Instead, pass the .innerHTML of the element, or use a function that',
                        'returns a cloned version of the element instead.',
                        `

`,
                        `1) content: element.innerHTML
`,
                        '2) content: () => element.cloneNode(true)',
                    ].join(' '),
                )
                var instances = elements.reduce(function (acc, reference) {
                    var instance =
                        reference && createTippy(reference, passedProps)
                    return instance && acc.push(instance), acc
                }, [])
                return isElement(targets) ? instances[0] : instances
            }
            ;(tippy2.defaultProps = defaultProps),
                (tippy2.setDefaultProps = setDefaultProps),
                (tippy2.currentInput = currentInput)
            var hideAll = function (_temp) {
                    var _ref = _temp === void 0 ? {} : _temp,
                        excludedReferenceOrInstance = _ref.exclude,
                        duration = _ref.duration
                    mountedInstances.forEach(function (instance) {
                        var isExcluded = !1
                        if (
                            (excludedReferenceOrInstance &&
                                (isExcluded = isReferenceElement(
                                    excludedReferenceOrInstance,
                                )
                                    ? instance.reference ===
                                      excludedReferenceOrInstance
                                    : instance.popper ===
                                      excludedReferenceOrInstance.popper),
                            !isExcluded)
                        ) {
                            var originalDuration = instance.props.duration
                            instance.setProps({ duration }),
                                instance.hide(),
                                instance.state.isDestroyed ||
                                    instance.setProps({
                                        duration: originalDuration,
                                    })
                        }
                    })
                },
                applyStylesModifier = Object.assign({}, core.applyStyles, {
                    effect: function (_ref) {
                        var state = _ref.state,
                            initialStyles = {
                                popper: {
                                    position: state.options.strategy,
                                    left: '0',
                                    top: '0',
                                    margin: '0',
                                },
                                arrow: { position: 'absolute' },
                                reference: {},
                            }
                        Object.assign(
                            state.elements.popper.style,
                            initialStyles.popper,
                        ),
                            (state.styles = initialStyles),
                            state.elements.arrow &&
                                Object.assign(
                                    state.elements.arrow.style,
                                    initialStyles.arrow,
                                )
                    },
                }),
                createSingleton = function (tippyInstances, optionalProps) {
                    var _optionalProps$popper
                    optionalProps === void 0 && (optionalProps = {}),
                        errorWhen(
                            !Array.isArray(tippyInstances),
                            [
                                'The first argument passed to createSingleton() must be an array of',
                                'tippy instances. The passed value was',
                                String(tippyInstances),
                            ].join(' '),
                        )
                    var individualInstances = tippyInstances,
                        references = [],
                        currentTarget,
                        overrides = optionalProps.overrides,
                        interceptSetPropsCleanups = [],
                        shownOnCreate = !1
                    function setReferences() {
                        references = individualInstances.map(function (
                            instance,
                        ) {
                            return instance.reference
                        })
                    }
                    function enableInstances(isEnabled) {
                        individualInstances.forEach(function (instance) {
                            isEnabled ? instance.enable() : instance.disable()
                        })
                    }
                    function interceptSetProps(singleton2) {
                        return individualInstances.map(function (instance) {
                            var originalSetProps2 = instance.setProps
                            return (
                                (instance.setProps = function (props) {
                                    originalSetProps2(props),
                                        instance.reference === currentTarget &&
                                            singleton2.setProps(props)
                                }),
                                function () {
                                    instance.setProps = originalSetProps2
                                }
                            )
                        })
                    }
                    function prepareInstance(singleton2, target) {
                        var index = references.indexOf(target)
                        if (target !== currentTarget) {
                            currentTarget = target
                            var overrideProps = (overrides || [])
                                .concat('content')
                                .reduce(function (acc, prop) {
                                    return (
                                        (acc[prop] =
                                            individualInstances[index].props[
                                                prop
                                            ]),
                                        acc
                                    )
                                }, {})
                            singleton2.setProps(
                                Object.assign({}, overrideProps, {
                                    getReferenceClientRect:
                                        typeof overrideProps.getReferenceClientRect ==
                                        'function'
                                            ? overrideProps.getReferenceClientRect
                                            : function () {
                                                  return target.getBoundingClientRect()
                                              },
                                }),
                            )
                        }
                    }
                    enableInstances(!1), setReferences()
                    var plugin2 = {
                            fn: function () {
                                return {
                                    onDestroy: function () {
                                        enableInstances(!0)
                                    },
                                    onHidden: function () {
                                        currentTarget = null
                                    },
                                    onClickOutside: function (instance) {
                                        instance.props.showOnCreate &&
                                            !shownOnCreate &&
                                            ((shownOnCreate = !0),
                                            (currentTarget = null))
                                    },
                                    onShow: function (instance) {
                                        instance.props.showOnCreate &&
                                            !shownOnCreate &&
                                            ((shownOnCreate = !0),
                                            prepareInstance(
                                                instance,
                                                references[0],
                                            ))
                                    },
                                    onTrigger: function (instance, event) {
                                        prepareInstance(
                                            instance,
                                            event.currentTarget,
                                        )
                                    },
                                }
                            },
                        },
                        singleton = tippy2(
                            div(),
                            Object.assign(
                                {},
                                removeProperties(optionalProps, ['overrides']),
                                {
                                    plugins: [plugin2].concat(
                                        optionalProps.plugins || [],
                                    ),
                                    triggerTarget: references,
                                    popperOptions: Object.assign(
                                        {},
                                        optionalProps.popperOptions,
                                        {
                                            modifiers: [].concat(
                                                ((_optionalProps$popper =
                                                    optionalProps.popperOptions) ==
                                                null
                                                    ? void 0
                                                    : _optionalProps$popper.modifiers) ||
                                                    [],
                                                [applyStylesModifier],
                                            ),
                                        },
                                    ),
                                },
                            ),
                        ),
                        originalShow = singleton.show
                    ;(singleton.show = function (target) {
                        if ((originalShow(), !currentTarget && target == null))
                            return prepareInstance(singleton, references[0])
                        if (!(currentTarget && target == null)) {
                            if (typeof target == 'number')
                                return (
                                    references[target] &&
                                    prepareInstance(
                                        singleton,
                                        references[target],
                                    )
                                )
                            if (individualInstances.includes(target)) {
                                var ref = target.reference
                                return prepareInstance(singleton, ref)
                            }
                            if (references.includes(target))
                                return prepareInstance(singleton, target)
                        }
                    }),
                        (singleton.showNext = function () {
                            var first = references[0]
                            if (!currentTarget) return singleton.show(0)
                            var index = references.indexOf(currentTarget)
                            singleton.show(references[index + 1] || first)
                        }),
                        (singleton.showPrevious = function () {
                            var last = references[references.length - 1]
                            if (!currentTarget) return singleton.show(last)
                            var index = references.indexOf(currentTarget),
                                target = references[index - 1] || last
                            singleton.show(target)
                        })
                    var originalSetProps = singleton.setProps
                    return (
                        (singleton.setProps = function (props) {
                            ;(overrides = props.overrides || overrides),
                                originalSetProps(props)
                        }),
                        (singleton.setInstances = function (nextInstances) {
                            enableInstances(!0),
                                interceptSetPropsCleanups.forEach(function (
                                    fn,
                                ) {
                                    return fn()
                                }),
                                (individualInstances = nextInstances),
                                enableInstances(!1),
                                setReferences(),
                                interceptSetProps(singleton),
                                singleton.setProps({
                                    triggerTarget: references,
                                })
                        }),
                        (interceptSetPropsCleanups =
                            interceptSetProps(singleton)),
                        singleton
                    )
                },
                BUBBLING_EVENTS_MAP = {
                    mouseover: 'mouseenter',
                    focusin: 'focus',
                    click: 'click',
                }
            function delegate(targets, props) {
                errorWhen(
                    !(props && props.target),
                    [
                        'You must specity a `target` prop indicating a CSS selector string matching',
                        'the target elements that should receive a tippy.',
                    ].join(' '),
                )
                var listeners = [],
                    childTippyInstances = [],
                    disabled = !1,
                    target = props.target,
                    nativeProps = removeProperties(props, ['target']),
                    parentProps = Object.assign({}, nativeProps, {
                        trigger: 'manual',
                        touch: !1,
                    }),
                    childProps = Object.assign({}, nativeProps, {
                        showOnCreate: !0,
                    }),
                    returnValue = tippy2(targets, parentProps),
                    normalizedReturnValue = normalizeToArray(returnValue)
                function onTrigger(event) {
                    if (!(!event.target || disabled)) {
                        var targetNode = event.target.closest(target)
                        if (!!targetNode) {
                            var trigger2 =
                                targetNode.getAttribute('data-tippy-trigger') ||
                                props.trigger ||
                                defaultProps.trigger
                            if (
                                !targetNode._tippy &&
                                !(
                                    event.type === 'touchstart' &&
                                    typeof childProps.touch == 'boolean'
                                ) &&
                                !(
                                    event.type !== 'touchstart' &&
                                    trigger2.indexOf(
                                        BUBBLING_EVENTS_MAP[event.type],
                                    ) < 0
                                )
                            ) {
                                var instance = tippy2(targetNode, childProps)
                                instance &&
                                    (childTippyInstances =
                                        childTippyInstances.concat(instance))
                            }
                        }
                    }
                }
                function on2(node, eventType, handler3, options) {
                    options === void 0 && (options = !1),
                        node.addEventListener(eventType, handler3, options),
                        listeners.push({
                            node,
                            eventType,
                            handler: handler3,
                            options,
                        })
                }
                function addEventListeners(instance) {
                    var reference = instance.reference
                    on2(reference, 'touchstart', onTrigger, TOUCH_OPTIONS),
                        on2(reference, 'mouseover', onTrigger),
                        on2(reference, 'focusin', onTrigger),
                        on2(reference, 'click', onTrigger)
                }
                function removeEventListeners() {
                    listeners.forEach(function (_ref) {
                        var node = _ref.node,
                            eventType = _ref.eventType,
                            handler3 = _ref.handler,
                            options = _ref.options
                        node.removeEventListener(eventType, handler3, options)
                    }),
                        (listeners = [])
                }
                function applyMutations(instance) {
                    var originalDestroy = instance.destroy,
                        originalEnable = instance.enable,
                        originalDisable = instance.disable
                    ;(instance.destroy = function (
                        shouldDestroyChildInstances,
                    ) {
                        shouldDestroyChildInstances === void 0 &&
                            (shouldDestroyChildInstances = !0),
                            shouldDestroyChildInstances &&
                                childTippyInstances.forEach(function (
                                    instance2,
                                ) {
                                    instance2.destroy()
                                }),
                            (childTippyInstances = []),
                            removeEventListeners(),
                            originalDestroy()
                    }),
                        (instance.enable = function () {
                            originalEnable(),
                                childTippyInstances.forEach(function (
                                    instance2,
                                ) {
                                    return instance2.enable()
                                }),
                                (disabled = !1)
                        }),
                        (instance.disable = function () {
                            originalDisable(),
                                childTippyInstances.forEach(function (
                                    instance2,
                                ) {
                                    return instance2.disable()
                                }),
                                (disabled = !0)
                        }),
                        addEventListeners(instance)
                }
                return (
                    normalizedReturnValue.forEach(applyMutations), returnValue
                )
            }
            var animateFill = {
                name: 'animateFill',
                defaultValue: !1,
                fn: function (instance) {
                    var _instance$props$rende
                    if (
                        !((_instance$props$rende = instance.props.render) ==
                        null
                            ? void 0
                            : _instance$props$rende.$$tippy)
                    )
                        return (
                            errorWhen(
                                instance.props.animateFill,
                                'The `animateFill` plugin requires the default render function.',
                            ),
                            {}
                        )
                    var _getChildren = getChildren(instance.popper),
                        box = _getChildren.box,
                        content = _getChildren.content,
                        backdrop = instance.props.animateFill
                            ? createBackdropElement()
                            : null
                    return {
                        onCreate: function () {
                            backdrop &&
                                (box.insertBefore(
                                    backdrop,
                                    box.firstElementChild,
                                ),
                                box.setAttribute('data-animatefill', ''),
                                (box.style.overflow = 'hidden'),
                                instance.setProps({
                                    arrow: !1,
                                    animation: 'shift-away',
                                }))
                        },
                        onMount: function () {
                            if (backdrop) {
                                var transitionDuration =
                                        box.style.transitionDuration,
                                    duration = Number(
                                        transitionDuration.replace('ms', ''),
                                    )
                                ;(content.style.transitionDelay =
                                    Math.round(duration / 10) + 'ms'),
                                    (backdrop.style.transitionDuration =
                                        transitionDuration),
                                    setVisibilityState([backdrop], 'visible')
                            }
                        },
                        onShow: function () {
                            backdrop &&
                                (backdrop.style.transitionDuration = '0ms')
                        },
                        onHide: function () {
                            backdrop && setVisibilityState([backdrop], 'hidden')
                        },
                    }
                },
            }
            function createBackdropElement() {
                var backdrop = div()
                return (
                    (backdrop.className = BACKDROP_CLASS),
                    setVisibilityState([backdrop], 'hidden'),
                    backdrop
                )
            }
            var mouseCoords = { clientX: 0, clientY: 0 },
                activeInstances = []
            function storeMouseCoords(_ref) {
                var clientX = _ref.clientX,
                    clientY = _ref.clientY
                mouseCoords = { clientX, clientY }
            }
            function addMouseCoordsListener(doc) {
                doc.addEventListener('mousemove', storeMouseCoords)
            }
            function removeMouseCoordsListener(doc) {
                doc.removeEventListener('mousemove', storeMouseCoords)
            }
            var followCursor2 = {
                name: 'followCursor',
                defaultValue: !1,
                fn: function (instance) {
                    var reference = instance.reference,
                        doc = getOwnerDocument(
                            instance.props.triggerTarget || reference,
                        ),
                        isInternalUpdate = !1,
                        wasFocusEvent = !1,
                        isUnmounted = !0,
                        prevProps = instance.props
                    function getIsInitialBehavior() {
                        return (
                            instance.props.followCursor === 'initial' &&
                            instance.state.isVisible
                        )
                    }
                    function addListener() {
                        doc.addEventListener('mousemove', onMouseMove)
                    }
                    function removeListener() {
                        doc.removeEventListener('mousemove', onMouseMove)
                    }
                    function unsetGetReferenceClientRect() {
                        ;(isInternalUpdate = !0),
                            instance.setProps({ getReferenceClientRect: null }),
                            (isInternalUpdate = !1)
                    }
                    function onMouseMove(event) {
                        var isCursorOverReference = event.target
                                ? reference.contains(event.target)
                                : !0,
                            followCursor3 = instance.props.followCursor,
                            clientX = event.clientX,
                            clientY = event.clientY,
                            rect = reference.getBoundingClientRect(),
                            relativeX = clientX - rect.left,
                            relativeY = clientY - rect.top
                        ;(isCursorOverReference ||
                            !instance.props.interactive) &&
                            instance.setProps({
                                getReferenceClientRect: function () {
                                    var rect2 =
                                            reference.getBoundingClientRect(),
                                        x = clientX,
                                        y = clientY
                                    followCursor3 === 'initial' &&
                                        ((x = rect2.left + relativeX),
                                        (y = rect2.top + relativeY))
                                    var top =
                                            followCursor3 === 'horizontal'
                                                ? rect2.top
                                                : y,
                                        right =
                                            followCursor3 === 'vertical'
                                                ? rect2.right
                                                : x,
                                        bottom =
                                            followCursor3 === 'horizontal'
                                                ? rect2.bottom
                                                : y,
                                        left =
                                            followCursor3 === 'vertical'
                                                ? rect2.left
                                                : x
                                    return {
                                        width: right - left,
                                        height: bottom - top,
                                        top,
                                        right,
                                        bottom,
                                        left,
                                    }
                                },
                            })
                    }
                    function create() {
                        instance.props.followCursor &&
                            (activeInstances.push({ instance, doc }),
                            addMouseCoordsListener(doc))
                    }
                    function destroy() {
                        ;(activeInstances = activeInstances.filter(function (
                            data2,
                        ) {
                            return data2.instance !== instance
                        })),
                            activeInstances.filter(function (data2) {
                                return data2.doc === doc
                            }).length === 0 && removeMouseCoordsListener(doc)
                    }
                    return {
                        onCreate: create,
                        onDestroy: destroy,
                        onBeforeUpdate: function () {
                            prevProps = instance.props
                        },
                        onAfterUpdate: function (_, _ref2) {
                            var followCursor3 = _ref2.followCursor
                            isInternalUpdate ||
                                (followCursor3 !== void 0 &&
                                    prevProps.followCursor !== followCursor3 &&
                                    (destroy(),
                                    followCursor3
                                        ? (create(),
                                          instance.state.isMounted &&
                                              !wasFocusEvent &&
                                              !getIsInitialBehavior() &&
                                              addListener())
                                        : (removeListener(),
                                          unsetGetReferenceClientRect())))
                        },
                        onMount: function () {
                            instance.props.followCursor &&
                                !wasFocusEvent &&
                                (isUnmounted &&
                                    (onMouseMove(mouseCoords),
                                    (isUnmounted = !1)),
                                getIsInitialBehavior() || addListener())
                        },
                        onTrigger: function (_, event) {
                            isMouseEvent(event) &&
                                (mouseCoords = {
                                    clientX: event.clientX,
                                    clientY: event.clientY,
                                }),
                                (wasFocusEvent = event.type === 'focus')
                        },
                        onHidden: function () {
                            instance.props.followCursor &&
                                (unsetGetReferenceClientRect(),
                                removeListener(),
                                (isUnmounted = !0))
                        },
                    }
                },
            }
            function getProps(props, modifier) {
                var _props$popperOptions
                return {
                    popperOptions: Object.assign({}, props.popperOptions, {
                        modifiers: [].concat(
                            (
                                ((_props$popperOptions = props.popperOptions) ==
                                null
                                    ? void 0
                                    : _props$popperOptions.modifiers) || []
                            ).filter(function (_ref) {
                                var name = _ref.name
                                return name !== modifier.name
                            }),
                            [modifier],
                        ),
                    }),
                }
            }
            var inlinePositioning = {
                name: 'inlinePositioning',
                defaultValue: !1,
                fn: function (instance) {
                    var reference = instance.reference
                    function isEnabled() {
                        return !!instance.props.inlinePositioning
                    }
                    var placement,
                        cursorRectIndex = -1,
                        isInternalUpdate = !1,
                        modifier = {
                            name: 'tippyInlinePositioning',
                            enabled: !0,
                            phase: 'afterWrite',
                            fn: function (_ref2) {
                                var state = _ref2.state
                                isEnabled() &&
                                    (placement !== state.placement &&
                                        instance.setProps({
                                            getReferenceClientRect:
                                                function () {
                                                    return _getReferenceClientRect(
                                                        state.placement,
                                                    )
                                                },
                                        }),
                                    (placement = state.placement))
                            },
                        }
                    function _getReferenceClientRect(placement2) {
                        return getInlineBoundingClientRect(
                            getBasePlacement(placement2),
                            reference.getBoundingClientRect(),
                            arrayFrom(reference.getClientRects()),
                            cursorRectIndex,
                        )
                    }
                    function setInternalProps(partialProps) {
                        ;(isInternalUpdate = !0),
                            instance.setProps(partialProps),
                            (isInternalUpdate = !1)
                    }
                    function addModifier() {
                        isInternalUpdate ||
                            setInternalProps(getProps(instance.props, modifier))
                    }
                    return {
                        onCreate: addModifier,
                        onAfterUpdate: addModifier,
                        onTrigger: function (_, event) {
                            if (isMouseEvent(event)) {
                                var rects = arrayFrom(
                                        instance.reference.getClientRects(),
                                    ),
                                    cursorRect = rects.find(function (rect) {
                                        return (
                                            rect.left - 2 <= event.clientX &&
                                            rect.right + 2 >= event.clientX &&
                                            rect.top - 2 <= event.clientY &&
                                            rect.bottom + 2 >= event.clientY
                                        )
                                    })
                                cursorRectIndex = rects.indexOf(cursorRect)
                            }
                        },
                        onUntrigger: function () {
                            cursorRectIndex = -1
                        },
                    }
                },
            }
            function getInlineBoundingClientRect(
                currentBasePlacement,
                boundingRect,
                clientRects,
                cursorRectIndex,
            ) {
                if (clientRects.length < 2 || currentBasePlacement === null)
                    return boundingRect
                if (
                    clientRects.length === 2 &&
                    cursorRectIndex >= 0 &&
                    clientRects[0].left > clientRects[1].right
                )
                    return clientRects[cursorRectIndex] || boundingRect
                switch (currentBasePlacement) {
                    case 'top':
                    case 'bottom': {
                        var firstRect = clientRects[0],
                            lastRect = clientRects[clientRects.length - 1],
                            isTop = currentBasePlacement === 'top',
                            top = firstRect.top,
                            bottom = lastRect.bottom,
                            left = isTop ? firstRect.left : lastRect.left,
                            right = isTop ? firstRect.right : lastRect.right,
                            width = right - left,
                            height = bottom - top
                        return { top, bottom, left, right, width, height }
                    }
                    case 'left':
                    case 'right': {
                        var minLeft = Math.min.apply(
                                Math,
                                clientRects.map(function (rects) {
                                    return rects.left
                                }),
                            ),
                            maxRight = Math.max.apply(
                                Math,
                                clientRects.map(function (rects) {
                                    return rects.right
                                }),
                            ),
                            measureRects = clientRects.filter(function (rect) {
                                return currentBasePlacement === 'left'
                                    ? rect.left === minLeft
                                    : rect.right === maxRight
                            }),
                            _top = measureRects[0].top,
                            _bottom =
                                measureRects[measureRects.length - 1].bottom,
                            _left = minLeft,
                            _right = maxRight,
                            _width = _right - _left,
                            _height = _bottom - _top
                        return {
                            top: _top,
                            bottom: _bottom,
                            left: _left,
                            right: _right,
                            width: _width,
                            height: _height,
                        }
                    }
                    default:
                        return boundingRect
                }
            }
            var sticky = {
                name: 'sticky',
                defaultValue: !1,
                fn: function (instance) {
                    var reference = instance.reference,
                        popper = instance.popper
                    function getReference() {
                        return instance.popperInstance
                            ? instance.popperInstance.state.elements.reference
                            : reference
                    }
                    function shouldCheck(value) {
                        return (
                            instance.props.sticky === !0 ||
                            instance.props.sticky === value
                        )
                    }
                    var prevRefRect = null,
                        prevPopRect = null
                    function updatePosition() {
                        var currentRefRect = shouldCheck('reference')
                                ? getReference().getBoundingClientRect()
                                : null,
                            currentPopRect = shouldCheck('popper')
                                ? popper.getBoundingClientRect()
                                : null
                        ;((currentRefRect &&
                            areRectsDifferent(prevRefRect, currentRefRect)) ||
                            (currentPopRect &&
                                areRectsDifferent(
                                    prevPopRect,
                                    currentPopRect,
                                ))) &&
                            instance.popperInstance &&
                            instance.popperInstance.update(),
                            (prevRefRect = currentRefRect),
                            (prevPopRect = currentPopRect),
                            instance.state.isMounted &&
                                requestAnimationFrame(updatePosition)
                    }
                    return {
                        onMount: function () {
                            instance.props.sticky && updatePosition()
                        },
                    }
                },
            }
            function areRectsDifferent(rectA, rectB) {
                return rectA && rectB
                    ? rectA.top !== rectB.top ||
                          rectA.right !== rectB.right ||
                          rectA.bottom !== rectB.bottom ||
                          rectA.left !== rectB.left
                    : !0
            }
            tippy2.setDefaultProps({ render }),
                (exports.animateFill = animateFill),
                (exports.createSingleton = createSingleton),
                (exports.default = tippy2),
                (exports.delegate = delegate),
                (exports.followCursor = followCursor2),
                (exports.hideAll = hideAll),
                (exports.inlinePositioning = inlinePositioning),
                (exports.roundArrow = ROUND_ARROW),
                (exports.sticky = sticky)
        }),
        import_tippy2 = __toModule2(require_tippy_cjs()),
        import_tippy = __toModule2(require_tippy_cjs()),
        buildConfigFromModifiers = (modifiers) => {
            let config = { plugins: [] },
                getModifierArgument = (modifier) =>
                    modifiers[modifiers.indexOf(modifier) + 1]
            if (
                (modifiers.includes('animation') &&
                    (config.animation = getModifierArgument('animation')),
                modifiers.includes('duration') &&
                    (config.duration = parseInt(
                        getModifierArgument('duration'),
                    )),
                modifiers.includes('delay'))
            ) {
                let delay = getModifierArgument('delay')
                config.delay = delay.includes('-')
                    ? delay.split('-').map((n) => parseInt(n))
                    : parseInt(delay)
            }
            if (modifiers.includes('cursor')) {
                config.plugins.push(import_tippy.followCursor)
                let next = getModifierArgument('cursor')
                ;['x', 'initial'].includes(next)
                    ? (config.followCursor =
                          next === 'x' ? 'horizontal' : 'initial')
                    : (config.followCursor = !0)
            }
            return (
                modifiers.includes('on') &&
                    (config.trigger = getModifierArgument('on')),
                modifiers.includes('arrowless') && (config.arrow = !1),
                modifiers.includes('html') && (config.allowHTML = !0),
                modifiers.includes('interactive') && (config.interactive = !0),
                modifiers.includes('border') &&
                    config.interactive &&
                    (config.interactiveBorder = parseInt(
                        getModifierArgument('border'),
                    )),
                modifiers.includes('debounce') &&
                    config.interactive &&
                    (config.interactiveDebounce = parseInt(
                        getModifierArgument('debounce'),
                    )),
                modifiers.includes('max-width') &&
                    (config.maxWidth = parseInt(
                        getModifierArgument('max-width'),
                    )),
                modifiers.includes('theme') &&
                    (config.theme = getModifierArgument('theme')),
                modifiers.includes('placement') &&
                    (config.placement = getModifierArgument('placement')),
                config
            )
        }
    function src_default4(Alpine2) {
        Alpine2.magic('tooltip', (el) => (content, config = {}) => {
            let instance = (0, import_tippy2.default)(el, {
                content,
                trigger: 'manual',
                ...config,
            })
            instance.show(),
                setTimeout(() => {
                    instance.hide(),
                        setTimeout(
                            () => instance.destroy(),
                            config.duration || 300,
                        )
                }, config.timeout || 2e3)
        }),
            Alpine2.directive(
                'tooltip',
                (
                    el,
                    { modifiers, expression },
                    { evaluateLater: evaluateLater2, effect: effect3 },
                ) => {
                    let config =
                        modifiers.length > 0
                            ? buildConfigFromModifiers(modifiers)
                            : {}
                    el.__x_tippy ||
                        (el.__x_tippy = (0, import_tippy2.default)(el, config))
                    let enableTooltip = () => el.__x_tippy.enable(),
                        disableTooltip = () => el.__x_tippy.disable(),
                        setupTooltip = (content) => {
                            content
                                ? (enableTooltip(),
                                  el.__x_tippy.setContent(content))
                                : disableTooltip()
                        }
                    if (modifiers.includes('raw')) setupTooltip(expression)
                    else {
                        let getContent = evaluateLater2(expression)
                        effect3(() => {
                            getContent((content) => {
                                typeof content == 'object'
                                    ? (el.__x_tippy.setProps(content),
                                      enableTooltip())
                                    : setupTooltip(content)
                            })
                        })
                    }
                },
            )
    }
    var module_default4 = src_default4
    document.addEventListener('alpine:init', () => {
        window.Alpine.plugin(module_default2),
            window.Alpine.plugin(module_default3),
            window.Alpine.plugin(module_default4),
            window.Alpine.store('sidebar', {
                isOpen: window.Alpine.$persist(!0).as('isOpen'),
                collapsedGroups:
                    window.Alpine.$persist(null).as('collapsedGroups'),
                groupIsCollapsed: function (group) {
                    return this.collapsedGroups.includes(group)
                },
                collapseGroup: function (group) {
                    this.collapsedGroups.includes(group) ||
                        (this.collapsedGroups =
                            this.collapsedGroups.concat(group))
                },
                toggleCollapsedGroup: function (group) {
                    this.collapsedGroups = this.collapsedGroups.includes(group)
                        ? this.collapsedGroups.filter(
                              (collapsedGroup) => collapsedGroup !== group,
                          )
                        : this.collapsedGroups.concat(group)
                },
                close: function () {
                    this.isOpen = !1
                },
                open: function () {
                    this.isOpen = !0
                },
            }),
            window.Alpine.store(
                'theme',
                window.matchMedia('(prefers-color-scheme: dark)').matches
                    ? 'dark'
                    : 'light',
            ),
            window.addEventListener('dark-mode-toggled', (event) => {
                window.Alpine.store('theme', event.detail)
            }),
            window
                .matchMedia('(prefers-color-scheme: dark)')
                .addEventListener('change', (event) => {
                    window.Alpine.store(
                        'theme',
                        event.matches ? 'dark' : 'light',
                    )
                })
    })
    window.Alpine = module_default
    module_default.start()
})()