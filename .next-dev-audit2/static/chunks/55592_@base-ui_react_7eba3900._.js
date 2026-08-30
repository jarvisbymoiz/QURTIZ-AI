(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/composite/root/CompositeRootContext.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CompositeRootContext",
    ()=>CompositeRootContext,
    "useCompositeRootContext",
    ()=>useCompositeRootContext
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
'use client';
;
;
const CompositeRootContext = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"](undefined);
if ("TURBOPACK compile-time truthy", 1) CompositeRootContext.displayName = "CompositeRootContext";
function useCompositeRootContext() {
    let optional = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : false;
    const context = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"](CompositeRootContext);
    if (context === undefined && !optional) {
        throw new Error(("TURBOPACK compile-time truthy", 1) ? 'Base UI: CompositeRootContext is missing. Composite parts must be placed within <Composite.Root>.' : "TURBOPACK unreachable");
    }
    return context;
}
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/utils/useFocusableWhenDisabled.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useFocusableWhenDisabled",
    ()=>useFocusableWhenDisabled
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
'use client';
;
function useFocusableWhenDisabled(parameters) {
    const { focusableWhenDisabled, disabled, composite = false, tabIndex: tabIndexProp = 0, isNativeButton } = parameters;
    const isFocusableComposite = composite && focusableWhenDisabled !== false;
    const isNonFocusableComposite = composite && focusableWhenDisabled === false;
    // we can't explicitly assign `undefined` to any of these props because it
    // would otherwise prevent subsequently merged props from setting them
    const props = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"]({
        "useFocusableWhenDisabled.useMemo[props]": ()=>{
            const additionalProps = {
                // allow Tabbing away from focusableWhenDisabled elements
                onKeyDown (event) {
                    if (disabled && focusableWhenDisabled && event.key !== 'Tab') {
                        event.preventDefault();
                    }
                }
            };
            if (!composite) {
                additionalProps.tabIndex = tabIndexProp;
                if (!isNativeButton && disabled) {
                    additionalProps.tabIndex = focusableWhenDisabled ? tabIndexProp : -1;
                }
            }
            if (isNativeButton && (focusableWhenDisabled || isFocusableComposite) || !isNativeButton && disabled) {
                additionalProps['aria-disabled'] = disabled;
            }
            if (isNativeButton && (!focusableWhenDisabled || isNonFocusableComposite)) {
                additionalProps.disabled = disabled;
            }
            return additionalProps;
        }
    }["useFocusableWhenDisabled.useMemo[props]"], [
        composite,
        disabled,
        focusableWhenDisabled,
        isFocusableComposite,
        isNonFocusableComposite,
        isNativeButton,
        tabIndexProp
    ]);
    return {
        props
    };
}
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/utils/dispatchClickWithModifiers.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "dispatchClickWithModifiers",
    ()=>dispatchClickWithModifiers
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$floating$2d$ui$2f$utils$2f$dist$2f$floating$2d$ui$2e$utils$2e$dom$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__getWindow__as__ownerWindow$3e$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@floating-ui/utils/dist/floating-ui.utils.dom.mjs [app-client] (ecmascript) <export getWindow as ownerWindow>");
;
function dispatchClickWithModifiers(target, sourceEvent) {
    let { detail = 0 } = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
    target.dispatchEvent(new ((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$floating$2d$ui$2f$utils$2f$dist$2f$floating$2d$ui$2e$utils$2e$dom$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__getWindow__as__ownerWindow$3e$__["ownerWindow"])(target)).PointerEvent('click', {
        bubbles: true,
        cancelable: true,
        composed: true,
        detail,
        shiftKey: sourceEvent.shiftKey,
        ctrlKey: sourceEvent.ctrlKey,
        altKey: sourceEvent.altKey,
        metaKey: sourceEvent.metaKey
    }));
}
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/use-button/useButton.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useButton",
    ()=>useButton
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$floating$2d$ui$2f$utils$2f$dist$2f$floating$2d$ui$2e$utils$2e$dom$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@floating-ui/utils/dist/floating-ui.utils.dom.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useStableCallback$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/useStableCallback.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$error$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/error.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$safeReact$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/safeReact.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useIsoLayoutEffect$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/useIsoLayoutEffect.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$merge$2d$props$2f$mergeProps$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/merge-props/mergeProps.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$composite$2f$root$2f$CompositeRootContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/composite/root/CompositeRootContext.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$utils$2f$useFocusableWhenDisabled$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/utils/useFocusableWhenDisabled.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$utils$2f$dispatchClickWithModifiers$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/utils/dispatchClickWithModifiers.mjs [app-client] (ecmascript)");
'use client';
;
;
;
;
;
;
;
;
;
;
function useButton() {
    let parameters = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    const { disabled = false, focusableWhenDisabled, tabIndex = 0, native: isNativeButton = true, composite: compositeProp } = parameters;
    const elementRef = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](null);
    const compositeRootContext = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$composite$2f$root$2f$CompositeRootContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCompositeRootContext"])(true);
    const isCompositeItem = compositeProp !== null && compositeProp !== void 0 ? compositeProp : compositeRootContext !== undefined;
    const { props: focusableWhenDisabledProps } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$utils$2f$useFocusableWhenDisabled$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useFocusableWhenDisabled"])({
        focusableWhenDisabled,
        disabled,
        composite: isCompositeItem,
        tabIndex,
        isNativeButton
    });
    if ("TURBOPACK compile-time truthy", 1) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
            "useButton.useEffect": ()=>{
                if (!elementRef.current) {
                    return;
                }
                const isButtonTag = isButtonElement(elementRef.current);
                if (isNativeButton) {
                    if (!isButtonTag) {
                        var _SafeReact_captureOwnerStack;
                        const ownerStackMessage = ((_SafeReact_captureOwnerStack = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$safeReact$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SafeReact"].captureOwnerStack) === null || _SafeReact_captureOwnerStack === void 0 ? void 0 : _SafeReact_captureOwnerStack.call(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$safeReact$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SafeReact"])) || '';
                        const message = 'A component that acts as a button expected a native <button> because the ' + '`nativeButton` prop is true. Rendering a non-<button> removes native button ' + 'semantics, which can impact forms and accessibility. Use a real <button> in the ' + '`render` prop, or set `nativeButton` to `false`.';
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$error$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["error"])("".concat(message).concat(ownerStackMessage));
                    }
                } else if (isButtonTag) {
                    var _SafeReact_captureOwnerStack1;
                    const ownerStackMessage = ((_SafeReact_captureOwnerStack1 = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$safeReact$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SafeReact"].captureOwnerStack) === null || _SafeReact_captureOwnerStack1 === void 0 ? void 0 : _SafeReact_captureOwnerStack1.call(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$safeReact$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SafeReact"])) || '';
                    const message = 'A component that acts as a button expected a non-<button> because the `nativeButton` ' + 'prop is false. Rendering a <button> keeps native behavior while Base UI applies ' + 'non-native attributes and handlers, which can add unintended extra attributes (such ' + 'as `role` or `aria-disabled`). Use a non-<button> in the `render` prop, or set ' + '`nativeButton` to `true`.';
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$error$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["error"])("".concat(message).concat(ownerStackMessage));
                }
            }
        }["useButton.useEffect"], [
            isNativeButton
        ]);
    }
    // handles a disabled composite button rendering another button, e.g.
    // <Toolbar.Button disabled render={<Menu.Trigger />} />
    // the `disabled` prop needs to pass through 2 `useButton`s then finally
    // delete the `disabled` attribute from DOM
    const updateDisabled = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useButton.useCallback[updateDisabled]": ()=>{
            const element = elementRef.current;
            if (!isButtonElement(element)) {
                return;
            }
            if (isCompositeItem && disabled && focusableWhenDisabledProps.disabled === undefined && element.disabled) {
                element.disabled = false;
            }
        }
    }["useButton.useCallback[updateDisabled]"], [
        disabled,
        focusableWhenDisabledProps.disabled,
        isCompositeItem
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useIsoLayoutEffect$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useIsoLayoutEffect"])(updateDisabled, [
        updateDisabled
    ]);
    const getButtonProps = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useButton.useCallback[getButtonProps]": function() {
            let externalProps = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
            const { onClick: externalOnClick, onMouseDown: externalOnMouseDown, onKeyUp: externalOnKeyUp, onKeyDown: externalOnKeyDown, onPointerDown: externalOnPointerDown, ...otherExternalProps } = externalProps;
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$merge$2d$props$2f$mergeProps$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["mergeProps"])({
                onClick (event) {
                    if (disabled) {
                        event.preventDefault();
                        return;
                    }
                    externalOnClick === null || externalOnClick === void 0 ? void 0 : externalOnClick(event);
                },
                onMouseDown (event) {
                    if (!disabled) {
                        externalOnMouseDown === null || externalOnMouseDown === void 0 ? void 0 : externalOnMouseDown(event);
                    }
                },
                onKeyDown (event) {
                    if (disabled) {
                        return;
                    }
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$merge$2d$props$2f$mergeProps$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["makeEventPreventable"])(event);
                    externalOnKeyDown === null || externalOnKeyDown === void 0 ? void 0 : externalOnKeyDown(event);
                    if (event.baseUIHandlerPrevented) {
                        return;
                    }
                    const isCurrentTarget = event.target === event.currentTarget;
                    const currentTarget = event.currentTarget;
                    const isButton = isButtonElement(currentTarget);
                    const isLink = !isNativeButton && isValidLinkElement(currentTarget);
                    const shouldClick = isCurrentTarget && (isNativeButton ? isButton : !isLink);
                    const isEnterKey = event.key === 'Enter';
                    const isSpaceKey = event.key === ' ';
                    const role = currentTarget.getAttribute('role');
                    const isTextNavigationRole = (role === null || role === void 0 ? void 0 : role.startsWith('menuitem')) || role === 'option' || role === 'gridcell';
                    if (isCurrentTarget && isCompositeItem && isSpaceKey) {
                        if (event.defaultPrevented && isTextNavigationRole) {
                            return;
                        }
                        event.preventDefault();
                        // Only a native-mode item that isn't a real <button> is excluded.
                        if (!isNativeButton || isButton) {
                            event.preventBaseUIHandler();
                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$utils$2f$dispatchClickWithModifiers$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["dispatchClickWithModifiers"])(currentTarget, event);
                        }
                        return;
                    }
                    // Keyboard accessibility for native and non-native elements.
                    if (!shouldClick || isNativeButton || !isSpaceKey && !isEnterKey) {
                        // Space activates links on keyup (`role="button"` semantics, matching the
                        // composite path); prevent the page scroll Space would otherwise trigger.
                        // Enter is left to the browser's native link activation.
                        if (isCurrentTarget && isLink && isSpaceKey) {
                            event.preventDefault();
                        }
                        return;
                    }
                    // Match native buttons: preventing the keydown's default cancels activation.
                    if (event.defaultPrevented) {
                        return;
                    }
                    event.preventDefault();
                    if (isEnterKey) {
                        event.preventBaseUIHandler();
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$utils$2f$dispatchClickWithModifiers$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["dispatchClickWithModifiers"])(currentTarget, event);
                    }
                },
                onKeyUp (event) {
                    if (disabled) {
                        return;
                    }
                    // calling preventDefault in keyUp on a <button> will not dispatch a click event if Space is pressed
                    // https://codesandbox.io/p/sandbox/button-keyup-preventdefault-dn7f0
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$merge$2d$props$2f$mergeProps$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["makeEventPreventable"])(event);
                    externalOnKeyUp === null || externalOnKeyUp === void 0 ? void 0 : externalOnKeyUp(event);
                    if (event.target === event.currentTarget && isNativeButton && isCompositeItem && isButtonElement(event.currentTarget) && event.key === ' ') {
                        event.preventDefault();
                        return;
                    }
                    if (event.baseUIHandlerPrevented) {
                        return;
                    }
                    // Keyboard accessibility for non interactive elements.
                    // Match native buttons: preventing the keyup's default cancels Space activation.
                    // Limitation: unlike a native <button>, a prevented *keydown* cannot cancel the
                    // activation — no state is kept between keydown and keyup, so we can't tell
                    // whether the keydown was prevented or even happened on this element.
                    if (event.target === event.currentTarget && !isNativeButton && !isCompositeItem && !event.defaultPrevented && event.key === ' ') {
                        event.preventBaseUIHandler();
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$utils$2f$dispatchClickWithModifiers$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["dispatchClickWithModifiers"])(event.currentTarget, event);
                    }
                },
                onPointerDown (event) {
                    if (disabled) {
                        event.preventDefault();
                        return;
                    }
                    externalOnPointerDown === null || externalOnPointerDown === void 0 ? void 0 : externalOnPointerDown(event);
                }
            }, isNativeButton ? {
                type: 'button'
            } : {
                role: 'button'
            }, focusableWhenDisabledProps, otherExternalProps);
        }
    }["useButton.useCallback[getButtonProps]"], [
        disabled,
        focusableWhenDisabledProps,
        isCompositeItem,
        isNativeButton
    ]);
    const buttonRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useStableCallback$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStableCallback"])({
        "useButton.useStableCallback[buttonRef]": (element)=>{
            elementRef.current = element;
            updateDisabled();
        }
    }["useButton.useStableCallback[buttonRef]"]);
    return {
        getButtonProps,
        buttonRef
    };
}
function isButtonElement(elem) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$floating$2d$ui$2f$utils$2f$dist$2f$floating$2d$ui$2e$utils$2e$dom$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isHTMLElement"])(elem) && elem.tagName === 'BUTTON';
}
function isValidLinkElement(elem) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$floating$2d$ui$2f$utils$2f$dist$2f$floating$2d$ui$2e$utils$2e$dom$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isHTMLElement"])(elem) && elem.tagName === 'A' && Boolean(elem.href);
}
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/button/Button.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Button",
    ()=>Button
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$use$2d$button$2f$useButton$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/use-button/useButton.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useRenderElement$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/useRenderElement.mjs [app-client] (ecmascript)");
'use client';
;
;
;
const Button = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](function Button(componentProps, forwardedRef) {
    const { render, className, disabled = false, focusableWhenDisabled = false, nativeButton = true, style, ...elementProps } = componentProps;
    const { getButtonProps, buttonRef } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$use$2d$button$2f$useButton$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useButton"])({
        disabled,
        focusableWhenDisabled,
        native: nativeButton
    });
    const state = {
        disabled
    };
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useRenderElement$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRenderElement"])('button', componentProps, {
        state,
        ref: [
            forwardedRef,
            buttonRef
        ],
        props: [
            elementProps,
            getButtonProps
        ]
    });
});
if ("TURBOPACK compile-time truthy", 1) Button.displayName = "Button";
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/index.parts.mjs [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
;
;
;
;
;
;
;
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/field-constants/constants.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DEFAULT_FIELD_ROOT_STATE",
    ()=>DEFAULT_FIELD_ROOT_STATE,
    "DEFAULT_FIELD_STATE_ATTRIBUTES",
    ()=>DEFAULT_FIELD_STATE_ATTRIBUTES,
    "DEFAULT_VALIDITY_STATE",
    ()=>DEFAULT_VALIDITY_STATE,
    "fieldValidityMapping",
    ()=>fieldValidityMapping
]);
const DEFAULT_VALIDITY_STATE = {
    badInput: false,
    customError: false,
    patternMismatch: false,
    rangeOverflow: false,
    rangeUnderflow: false,
    stepMismatch: false,
    tooLong: false,
    tooShort: false,
    typeMismatch: false,
    valid: null,
    valueMissing: false
};
const DEFAULT_FIELD_STATE_ATTRIBUTES = {
    valid: null,
    touched: false,
    dirty: false,
    filled: false,
    focused: false
};
const DEFAULT_FIELD_ROOT_STATE = {
    disabled: false,
    ...DEFAULT_FIELD_STATE_ATTRIBUTES
};
const fieldValidityMapping = {
    valid (value) {
        if (value === null) {
            return null;
        }
        if (value) {
            return {
                'data-valid': ''
            };
        }
        return {
            'data-invalid': ''
        };
    }
};
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/field-root-context/FieldRootContext.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DEFAULT_FIELD_ROOT_CONTEXT",
    ()=>DEFAULT_FIELD_ROOT_CONTEXT,
    "FieldRootContext",
    ()=>FieldRootContext,
    "useFieldRootContext",
    ()=>useFieldRootContext
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$empty$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/empty.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$constants$2f$constants$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/field-constants/constants.mjs [app-client] (ecmascript)");
'use client';
;
;
;
;
;
const DEFAULT_FIELD_ROOT_CONTEXT = {
    invalid: undefined,
    name: undefined,
    validityData: {
        state: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$constants$2f$constants$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_VALIDITY_STATE"],
        errors: [],
        error: '',
        value: '',
        initialValue: null
    },
    setValidityData: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$empty$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NOOP"],
    disabled: undefined,
    setTouched: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$empty$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NOOP"],
    setDirty: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$empty$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NOOP"],
    setFilled: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$empty$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NOOP"],
    setFocused: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$empty$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NOOP"],
    validationMode: 'onSubmit',
    shouldValidateOnChange: ()=>false,
    state: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$constants$2f$constants$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_FIELD_ROOT_STATE"],
    registerFieldControl: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$empty$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NOOP"],
    validation: {
        getValidationProps: function(_disabled) {
            let props = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$empty$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EMPTY_OBJECT"];
            return props;
        },
        inputRef: {
            current: null
        },
        registeredInputs: new Map(),
        registerInput: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$empty$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NOOP"],
        getInputControl: ()=>null,
        commit: async ()=>{},
        change: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$empty$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NOOP"]
    }
};
const FieldRootContext = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"](DEFAULT_FIELD_ROOT_CONTEXT);
if ("TURBOPACK compile-time truthy", 1) FieldRootContext.displayName = "FieldRootContext";
function useFieldRootContext() {
    let optional = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : true;
    const context = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"](FieldRootContext);
    if (context.setValidityData === __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$empty$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NOOP"] && !optional) {
        throw new Error(("TURBOPACK compile-time truthy", 1) ? 'Base UI: FieldRootContext is missing. Field parts must be placed within <Field.Root>.' : "TURBOPACK unreachable");
    }
    return context;
}
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/fieldset/root/FieldsetRootContext.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FieldsetRootContext",
    ()=>FieldsetRootContext,
    "useFieldsetRootContext",
    ()=>useFieldsetRootContext
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
'use client';
;
;
const FieldsetRootContext = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"](undefined);
if ("TURBOPACK compile-time truthy", 1) FieldsetRootContext.displayName = "FieldsetRootContext";
function useFieldsetRootContext() {
    let optional = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : false;
    const context = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"](FieldsetRootContext);
    if (!context && !optional) {
        throw new Error(("TURBOPACK compile-time truthy", 1) ? 'Base UI: FieldsetRootContext is missing. Fieldset parts must be placed within <Fieldset.Root>.' : "TURBOPACK unreachable");
    }
    return context;
}
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/form-context/FormContext.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FormContext",
    ()=>FormContext,
    "useFormContext",
    ()=>useFormContext
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$empty$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/empty.mjs [app-client] (ecmascript)");
'use client';
;
;
const FormContext = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"]({
    elementRef: {
        current: null
    },
    formRef: {
        current: {
            fields: new Map()
        }
    },
    errors: {},
    clearErrors: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$empty$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NOOP"],
    validationMode: 'onSubmit',
    submitAttemptedRef: {
        current: false
    }
});
if ("TURBOPACK compile-time truthy", 1) FormContext.displayName = "FormContext";
function useFormContext() {
    return __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"](FormContext);
}
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/labelable-provider/LabelableContext.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LabelableContext",
    ()=>LabelableContext,
    "useLabelableContext",
    ()=>useLabelableContext
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$empty$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/empty.mjs [app-client] (ecmascript)");
'use client';
;
;
const LabelableContext = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"]({
    controlId: undefined,
    registerControlId: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$empty$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NOOP"],
    labelId: undefined,
    setLabelId: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$empty$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NOOP"],
    messageIds: [],
    setMessageIds: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$empty$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NOOP"],
    getDescriptionProps: (externalProps)=>externalProps
});
if ("TURBOPACK compile-time truthy", 1) LabelableContext.displayName = "LabelableContext";
function useLabelableContext() {
    return __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"](LabelableContext);
}
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/labelable-provider/LabelableProvider.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LabelableProvider",
    ()=>LabelableProvider
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useStableCallback$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/useStableCallback.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useRefWithInit$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/useRefWithInit.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useBaseUiId$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/useBaseUiId.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$labelable$2d$provider$2f$LabelableContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/labelable-provider/LabelableContext.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
'use client';
;
;
;
;
;
;
const LabelableProvider = function LabelableProvider(props) {
    const defaultId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useBaseUiId$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useBaseUiId"])();
    const initialControlId = props.controlId === undefined ? defaultId : props.controlId;
    const [controlId, setControlIdState] = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](initialControlId);
    const [labelId, setLabelId] = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](props.labelId);
    const [messageIds, setMessageIds] = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"]([]);
    const registrationsRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useRefWithInit$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRefWithInit"])({
        "LabelableProvider.useRefWithInit[registrationsRef]": ()=>new Map()
    }["LabelableProvider.useRefWithInit[registrationsRef]"]);
    const { messageIds: parentMessageIds } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$labelable$2d$provider$2f$LabelableContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLabelableContext"])();
    const registerControlId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useStableCallback$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStableCallback"])({
        "LabelableProvider.useStableCallback[registerControlId]": (source, nextId)=>{
            const registrations = registrationsRef.current;
            if (nextId === undefined) {
                registrations.delete(source);
                return;
            }
            registrations.set(source, nextId);
            // Only flush when registering, not when unregistering.
            // This prevents loops during rapid unmount/remount cycles (e.g. React Activity).
            // The next registration will pick up the correct state.
            setControlIdState({
                "LabelableProvider.useStableCallback[registerControlId]": (prev)=>{
                    if (registrations.size === 0) {
                        return undefined;
                    }
                    let nextControlId;
                    for (const id of registrations.values()){
                        if (prev !== undefined && id === prev) {
                            return prev;
                        }
                        if (nextControlId === undefined) {
                            nextControlId = id;
                        }
                    }
                    return nextControlId;
                }
            }["LabelableProvider.useStableCallback[registerControlId]"]);
        }
    }["LabelableProvider.useStableCallback[registerControlId]"]);
    const getDescriptionProps = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "LabelableProvider.useCallback[getDescriptionProps]": (externalProps)=>{
            const ids = externalProps['aria-describedby'] ? externalProps['aria-describedby'].split(' ') : [];
            ids.push(...parentMessageIds, ...messageIds);
            return {
                ...externalProps,
                'aria-describedby': Array.from(new Set(ids)).join(' ') || undefined
            };
        }
    }["LabelableProvider.useCallback[getDescriptionProps]"], [
        parentMessageIds,
        messageIds
    ]);
    const contextValue = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"]({
        "LabelableProvider.useMemo[contextValue]": ()=>({
                controlId,
                registerControlId,
                labelId,
                setLabelId,
                messageIds,
                setMessageIds,
                getDescriptionProps
            })
    }["LabelableProvider.useMemo[contextValue]"], [
        controlId,
        registerControlId,
        labelId,
        setLabelId,
        messageIds,
        setMessageIds,
        getDescriptionProps
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsx"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$labelable$2d$provider$2f$LabelableContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LabelableContext"].Provider, {
        value: contextValue,
        children: props.children
    });
};
if ("TURBOPACK compile-time truthy", 1) LabelableProvider.displayName = "LabelableProvider";
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/utils/getCombinedFieldValidityData.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Combines the field's client-side, stateful validity data with the external invalid state to
 * determine the field's true validity.
 */ __turbopack_context__.s([
    "getCombinedFieldValidityData",
    ()=>getCombinedFieldValidityData
]);
function getCombinedFieldValidityData(validityData, invalid) {
    return {
        ...validityData,
        state: {
            ...validityData.state,
            valid: !invalid && validityData.state.valid
        }
    };
}
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/root/useFieldValidation.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isEligibleInput",
    ()=>isEligibleInput,
    "useFieldValidation",
    ()=>useFieldValidation
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$empty$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/empty.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useTimeout$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/useTimeout.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useStableCallback$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/useStableCallback.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useRefWithInit$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/useRefWithInit.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$labelable$2d$provider$2f$LabelableContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/labelable-provider/LabelableContext.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$merge$2d$props$2f$mergeProps$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/merge-props/mergeProps.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$constants$2f$constants$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/field-constants/constants.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$form$2d$context$2f$FormContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/form-context/FormContext.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$utils$2f$getCombinedFieldValidityData$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/utils/getCombinedFieldValidityData.mjs [app-client] (ecmascript)");
'use client';
;
;
;
;
;
;
;
;
;
;
const validityKeys = Object.keys(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$constants$2f$constants$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_VALIDITY_STATE"]);
function isEligibleInput(input, formElement) {
    if (input.matches(':disabled')) {
        return false;
    }
    if (!formElement || input.form === formElement) {
        return true;
    }
    // React context crosses portal boundaries. An unassociated portaled input still participates in
    // contextual validation, unless an explicit `form` attribute opts it out of the surrounding Form.
    return input.form === null && !input.hasAttribute('form');
}
/**
 * Picks the input whose native validity should represent a field that owns several inputs (such as a
 * checkbox or radio group). Prefers the first eligible currently-invalid input, where "first" follows
 * registration order (mount order), and otherwise returns the first eligible input.
 */ function findRepresentativeInput(inputs, formElement) {
    let fallback = null;
    for (const input of inputs.keys()){
        if (!isEligibleInput(input, formElement)) {
            continue;
        }
        if (!input.validity.valid) {
            return input;
        }
        fallback !== null && fallback !== void 0 ? fallback : fallback = input;
    }
    return fallback;
}
function clearCustomValidity(element, inputs) {
    for (const input of inputs.keys()){
        input.setCustomValidity('');
    }
    element === null || element === void 0 ? void 0 : element.setCustomValidity('');
}
function useFieldValidation(params) {
    const { elementRef, formRef } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$form$2d$context$2f$FormContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useFormContext"])();
    const { setValidityData, validate, validityData, validationDebounceTime, invalid, markedDirtyRef, state, shouldValidateOnChange, registeredFieldIdRef } = params;
    const { controlId, getDescriptionProps } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$labelable$2d$provider$2f$LabelableContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLabelableContext"])();
    const timeout = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useTimeout$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTimeout"])();
    const inputRef = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](null);
    const registeredInputs = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useRefWithInit$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRefWithInit"])({
        "useFieldValidation.useRefWithInit": ()=>new Map()
    }["useFieldValidation.useRefWithInit"]).current;
    const validationCommitIdRef = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](0);
    // Groups register several inputs against a single field so focus, validation, and form-value
    // projection can use the same live controls. This also ensures a `required` checkbox can't be
    // satisfied by another input in the group, matching native per-checkbox behavior.
    const registerInput = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useFieldValidation.useCallback[registerInput]": (element, registration)=>{
            registeredInputs.set(element, registration);
            return ({
                "useFieldValidation.useCallback[registerInput]": ()=>{
                    registeredInputs.delete(element);
                }
            })["useFieldValidation.useCallback[registerInput]"];
        }
    }["useFieldValidation.useCallback[registerInput]"], [
        registeredInputs
    ]);
    const getInputControl = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useStableCallback$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStableCallback"])({
        "useFieldValidation.useStableCallback[getInputControl]": ()=>{
            var _registeredInputs_get;
            const element = findRepresentativeInput(registeredInputs, elementRef.current);
            return element && ((_registeredInputs_get = registeredInputs.get(element)) === null || _registeredInputs_get === void 0 ? void 0 : _registeredInputs_get.controlRef.current) || null;
        }
    }["useFieldValidation.useStableCallback[getInputControl]"]);
    const commit = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useStableCallback$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStableCallback"])({
        "useFieldValidation.useStableCallback[commit]": async function(value) {
            let revalidate = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : false;
            validationCommitIdRef.current += 1;
            const validationCommitId = validationCommitIdRef.current;
            function updateRegisteredFieldValidity(nextValidityData) {
                let externalInvalid = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : invalid;
                var _registeredFieldIdRef_current;
                const fieldId = (_registeredFieldIdRef_current = registeredFieldIdRef.current) !== null && _registeredFieldIdRef_current !== void 0 ? _registeredFieldIdRef_current : controlId;
                if (fieldId == null) {
                    return;
                }
                const currentFieldData = formRef.current.fields.get(fieldId);
                if (!currentFieldData) {
                    return;
                }
                const validityDataWithFormErrors = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$utils$2f$getCombinedFieldValidityData$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getCombinedFieldValidityData"])(nextValidityData, externalInvalid);
                formRef.current.fields.set(fieldId, {
                    ...currentFieldData,
                    validityData: validityDataWithFormErrors
                });
            }
            function publishAllValid(input, externalInvalid) {
                const nextValidityData = {
                    value,
                    state: {
                        ...__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$constants$2f$constants$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_VALIDITY_STATE"],
                        valid: true
                    },
                    error: '',
                    errors: [],
                    initialValue: validityData.initialValue
                };
                clearCustomValidity(input, registeredInputs);
                updateRegisteredFieldValidity(nextValidityData, externalInvalid);
                setValidityData(nextValidityData);
            }
            // A field can own several inputs (such as a checkbox or radio group), but only the last-mounted
            // one wins the shared `inputRef`. Validate against the registry instead so every input counts;
            // `inputRef` is the fallback only when no inputs are registered.
            const element = registeredInputs.size > 0 ? findRepresentativeInput(registeredInputs, elementRef.current) : inputRef.current;
            // A field with no eligible input has no native constraint, but its custom validator still
            // applies to the logical value at the configured validation boundary.
            if (revalidate) {
                if (state.valid !== false || !element) {
                    return;
                }
                const currentNativeValidity = element.validity;
                if (!currentNativeValidity.valueMissing) {
                    // The 'valueMissing' (required) condition has been resolved by the user typing.
                    // Temporarily mark the field as valid for this onChange event.
                    // Other native errors (e.g., typeMismatch) will be caught by full validation on blur or submit.
                    // The required value is now present; ignore stale external invalid state for this pass.
                    publishAllValid(element, false);
                    return;
                }
                // A stale custom error can coexist with valueMissing, but defer any other native errors.
                for (const key of validityKeys){
                    if (key !== 'valid' && key !== 'valueMissing' && key !== 'customError' && currentNativeValidity[key]) {
                        return;
                    }
                }
            // Value is still missing: publish the current native state so valueMissing and the changed
            // value are observable immediately. Full custom validation still waits for its boundary.
            }
            function getState(el) {
                const computedState = validityKeys.reduce({
                    "useFieldValidation.useStableCallback[commit].getState.computedState": (acc, key)=>{
                        acc[key] = el.validity[key];
                        return acc;
                    }
                }["useFieldValidation.useStableCallback[commit].getState.computedState"], {});
                let hasOnlyValueMissingError = false;
                for (const key of validityKeys){
                    if (key === 'valid') {
                        continue;
                    }
                    if (key === 'valueMissing' && computedState[key]) {
                        hasOnlyValueMissingError = true;
                    } else if (computedState[key]) {
                        return computedState;
                    }
                }
                // Only make `valueMissing` mark the field invalid if it's been changed
                // to reduce error noise.
                if (hasOnlyValueMissingError && !markedDirtyRef.current) {
                    computedState.valid = true;
                    computedState.valueMissing = false;
                }
                return computedState;
            }
            timeout.clear();
            let result = null;
            let validationErrors = [];
            // With no representative input the field carries no native constraint, so start from an
            // all-valid native state and let the custom `validate` result below decide the outcome.
            const nextState = element ? getState(element) : {
                ...__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$constants$2f$constants$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_VALIDITY_STATE"],
                valid: true
            };
            let defaultValidationMessage;
            const isValidatingOnChange = shouldValidateOnChange();
            if (element && element.validationMessage && !isValidatingOnChange) {
                // not validating on change, if there is a `validationMessage` from
                // native validity, set errors and skip calling the custom validate fn
                defaultValidationMessage = element.validationMessage;
                validationErrors = [
                    element.validationMessage
                ];
            } else {
                // call the validate function because either
                // - validating on change, or
                // - native constraint validations passed, custom validity check is next
                const formValues = Array.from(formRef.current.fields.values()).reduce({
                    "useFieldValidation.useStableCallback[commit].formValues": (acc, field)=>{
                        if (field.name) {
                            acc[field.name] = field.getValue();
                        }
                        return acc;
                    }
                }["useFieldValidation.useStableCallback[commit].formValues"], {});
                const resultOrPromise = validate(value, formValues);
                if (typeof resultOrPromise === 'object' && resultOrPromise !== null && 'then' in resultOrPromise) {
                    result = await resultOrPromise;
                    if (validationCommitId !== validationCommitIdRef.current) {
                        return;
                    }
                } else {
                    result = resultOrPromise;
                }
                if (result !== null) {
                    nextState.valid = false;
                    nextState.customError = true;
                    if (Array.isArray(result)) {
                        validationErrors = result;
                        element === null || element === void 0 ? void 0 : element.setCustomValidity(result.join('\n'));
                    } else if (result) {
                        validationErrors = [
                            result
                        ];
                        element === null || element === void 0 ? void 0 : element.setCustomValidity(result);
                    }
                } else if (isValidatingOnChange) {
                    // validate function returned no errors, if validating on change
                    // we need to clear the custom validity state
                    clearCustomValidity(element, registeredInputs);
                    nextState.customError = false;
                    if (element && element.validationMessage) {
                        defaultValidationMessage = element.validationMessage;
                        validationErrors = [
                            element.validationMessage
                        ];
                    } else if ((!element || element.validity.valid) && !nextState.valid) {
                        nextState.valid = true;
                    }
                }
            }
            const nextValidityData = {
                value,
                state: nextState,
                error: defaultValidationMessage !== null && defaultValidationMessage !== void 0 ? defaultValidationMessage : Array.isArray(result) ? result[0] : result !== null && result !== void 0 ? result : '',
                errors: validationErrors,
                initialValue: validityData.initialValue
            };
            // Keep Form-level errors part of overall field validity for submit blocking/focus logic.
            updateRegisteredFieldValidity(nextValidityData);
            setValidityData(nextValidityData);
        }
    }["useFieldValidation.useStableCallback[commit]"]);
    const change = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useStableCallback$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStableCallback"])({
        "useFieldValidation.useStableCallback[change]": (value)=>{
            timeout.clear();
            const validateOnChange = shouldValidateOnChange();
            if (validateOnChange && value !== '' && validationDebounceTime) {
                validationCommitIdRef.current += 1;
                timeout.start(validationDebounceTime, {
                    "useFieldValidation.useStableCallback[change]": ()=>{
                        commit(value);
                    }
                }["useFieldValidation.useStableCallback[change]"]);
            } else {
                commit(value, !validateOnChange);
            }
        }
    }["useFieldValidation.useStableCallback[change]"]);
    const getValidationProps = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useFieldValidation.useCallback[getValidationProps]": function(disabled) {
            let externalProps = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$merge$2d$props$2f$mergeProps$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["mergeProps"])(getDescriptionProps(externalProps), state.valid === false && !state.disabled && !disabled ? {
                'aria-invalid': true
            } : __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$empty$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EMPTY_OBJECT"]);
        }
    }["useFieldValidation.useCallback[getValidationProps]"], [
        getDescriptionProps,
        state.disabled,
        state.valid
    ]);
    return __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"]({
        "useFieldValidation.useMemo": ()=>({
                getValidationProps,
                inputRef,
                registeredInputs,
                registerInput,
                getInputControl,
                commit,
                change
            })
    }["useFieldValidation.useMemo"], [
        getValidationProps,
        registeredInputs,
        registerInput,
        getInputControl,
        commit,
        change
    ]);
}
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/field-register-control/useFieldControlRegistration.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useFieldControlRegistration",
    ()=>useFieldControlRegistration
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useIsoLayoutEffect$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/useIsoLayoutEffect.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useStableCallback$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/useStableCallback.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$utils$2f$getCombinedFieldValidityData$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/utils/getCombinedFieldValidityData.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$form$2d$context$2f$FormContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/form-context/FormContext.mjs [app-client] (ecmascript)");
'use client';
;
;
;
;
;
function useFieldControlRegistration(params) {
    const { commit, invalid, markedDirtyRef, name, setRegisteredFieldName, registeredFieldIdRef, setValidityData, validityData } = params;
    const { formRef } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$form$2d$context$2f$FormContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useFormContext"])();
    const activeFieldControlSourceRef = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](null);
    const registrationRef = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](null);
    const initialValueCapturedRef = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](false);
    const getValueForForm = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useStableCallback$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStableCallback"])({
        "useFieldControlRegistration.useStableCallback[getValueForForm]": ()=>{
            const registration = registrationRef.current;
            if (!registration) {
                return undefined;
            }
            if (registration.getValue) {
                return registration.getValue();
            }
            return registration.value;
        }
    }["useFieldControlRegistration.useStableCallback[getValueForForm]"]);
    function getRegistrationValue(registration) {
        return registration.value === undefined ? getValueForForm() : registration.value;
    }
    const validate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useStableCallback$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStableCallback"])({
        "useFieldControlRegistration.useStableCallback[validate]": ()=>{
            const registration = registrationRef.current;
            markedDirtyRef.current = true;
            if (!registration) {
                commit(validityData.value);
                return;
            }
            commit(getRegistrationValue(registration));
        }
    }["useFieldControlRegistration.useStableCallback[validate]"]);
    function refreshRegistration() {
        const registration = registrationRef.current;
        if (!registration || !registration.id) {
            return;
        }
        formRef.current.fields.set(registration.id, {
            getValue: getValueForForm,
            name: name !== null && name !== void 0 ? name : registration.name,
            controlRef: registration.controlRef,
            validityData: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$utils$2f$getCombinedFieldValidityData$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getCombinedFieldValidityData"])(validityData, invalid),
            validate
        });
    }
    function deleteRegistration() {
        let id = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : (()=>{
            var _registrationRef_current;
            return (_registrationRef_current = registrationRef.current) === null || _registrationRef_current === void 0 ? void 0 : _registrationRef_current.id;
        })();
        if (id) {
            formRef.current.fields.delete(id);
        }
    }
    // The baseline belongs to the field, not to a control instance: registration re-runs on every
    // value change, and a control that unmounts and remounts (or is swapped for another one) comes
    // back as a brand new registration. Capturing more than once would turn whichever value the
    // control happens to hold at that point into the initial value, so a modified field would read
    // pristine and its real initial value would read dirty. Consumers that want a fresh baseline
    // remount or key `<Field.Root>` itself.
    function captureInitialValue(registration) {
        if (initialValueCapturedRef.current) {
            return;
        }
        initialValueCapturedRef.current = true;
        const initialValue = getRegistrationValue(registration);
        setValidityData((prev)=>prev.initialValue === initialValue ? prev : {
                ...prev,
                initialValue
            });
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useIsoLayoutEffect$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useIsoLayoutEffect"])({
        "useFieldControlRegistration.useIsoLayoutEffect": ()=>{
            const registration = registrationRef.current;
            if (!registration || !registration.id) {
                return;
            }
            setRegisteredFieldName(name ? undefined : registration.name);
            formRef.current.fields.set(registration.id, {
                getValue: getValueForForm,
                name: name !== null && name !== void 0 ? name : registration.name,
                controlRef: registration.controlRef,
                validityData: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$utils$2f$getCombinedFieldValidityData$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getCombinedFieldValidityData"])(validityData, invalid),
                validate
            });
        }
    }["useFieldControlRegistration.useIsoLayoutEffect"], [
        formRef,
        getValueForForm,
        invalid,
        name,
        setRegisteredFieldName,
        validate,
        validityData
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useIsoLayoutEffect$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useIsoLayoutEffect"])({
        "useFieldControlRegistration.useIsoLayoutEffect": ()=>{
            const fields = formRef.current.fields;
            return ({
                "useFieldControlRegistration.useIsoLayoutEffect": ()=>{
                    var _registrationRef_current;
                    const id = (_registrationRef_current = registrationRef.current) === null || _registrationRef_current === void 0 ? void 0 : _registrationRef_current.id;
                    if (id) {
                        fields.delete(id);
                    }
                }
            })["useFieldControlRegistration.useIsoLayoutEffect"];
        }
    }["useFieldControlRegistration.useIsoLayoutEffect"], [
        formRef
    ]);
    const register = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useStableCallback$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStableCallback"])({
        "useFieldControlRegistration.useStableCallback[register]": (source, registration)=>{
            var _registrationRef_current;
            if (!registration) {
                if (activeFieldControlSourceRef.current === source) {
                    activeFieldControlSourceRef.current = null;
                    deleteRegistration();
                    registrationRef.current = null;
                    setRegisteredFieldName(undefined);
                    registeredFieldIdRef.current = undefined;
                }
                return;
            }
            const previousId = (_registrationRef_current = registrationRef.current) === null || _registrationRef_current === void 0 ? void 0 : _registrationRef_current.id;
            activeFieldControlSourceRef.current = source;
            registrationRef.current = registration;
            if (!name) {
                setRegisteredFieldName(registration.name);
            }
            registeredFieldIdRef.current = registration.id;
            if (previousId && previousId !== registration.id) {
                deleteRegistration(previousId);
            }
            captureInitialValue(registration);
            refreshRegistration();
        }
    }["useFieldControlRegistration.useStableCallback[register]"]);
    return [
        validate,
        register
    ];
}
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/root/FieldRoot.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FieldRoot",
    ()=>FieldRoot
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useIsoLayoutEffect$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/useIsoLayoutEffect.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useStableCallback$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/useStableCallback.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$root$2d$context$2f$FieldRootContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/field-root-context/FieldRootContext.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$constants$2f$constants$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/field-constants/constants.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$fieldset$2f$root$2f$FieldsetRootContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/fieldset/root/FieldsetRootContext.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$form$2d$context$2f$FormContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/form-context/FormContext.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$labelable$2d$provider$2f$LabelableProvider$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/labelable-provider/LabelableProvider.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useRenderElement$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/useRenderElement.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$root$2f$useFieldValidation$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/root/useFieldValidation.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$register$2d$control$2f$useFieldControlRegistration$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/field-register-control/useFieldControlRegistration.mjs [app-client] (ecmascript)");
/**
 * @internal
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
'use client';
;
;
;
;
;
;
;
;
;
;
;
;
const FieldRootInner = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](function FieldRootInner(componentProps, forwardedRef) {
    var _useFieldsetRootContext;
    const { errors, validationMode: formValidationMode, submitAttemptedRef } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$form$2d$context$2f$FormContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useFormContext"])();
    const { render, className, validate: validateProp, validationDebounceTime = 0, validationMode = formValidationMode, name, disabled: disabledProp = false, invalid: invalidProp, dirty: dirtyProp, touched: touchedProp, actionsRef, style, ...elementProps } = componentProps;
    const disabledFieldset = (_useFieldsetRootContext = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$fieldset$2f$root$2f$FieldsetRootContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useFieldsetRootContext"])(true)) === null || _useFieldsetRootContext === void 0 ? void 0 : _useFieldsetRootContext.disabled;
    const validate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useStableCallback$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStableCallback"])(validateProp || ({
        "FieldRootInner.FieldRootInner.useStableCallback[validate]": ()=>null
    })["FieldRootInner.FieldRootInner.useStableCallback[validate]"]);
    const disabled = disabledFieldset || disabledProp;
    const [touchedState, setTouchedUnwrapped] = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](false);
    const [dirtyState, setDirtyUnwrapped] = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](false);
    const [filled, setFilled] = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](false);
    const [focused, setFocused] = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](false);
    const dirty = dirtyProp !== null && dirtyProp !== void 0 ? dirtyProp : dirtyState;
    const touched = touchedProp !== null && touchedProp !== void 0 ? touchedProp : touchedState;
    const markedDirtyRef = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](dirty);
    const registeredFieldIdRef = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](undefined);
    const [registeredFieldName, setRegisteredFieldName] = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"]();
    const effectiveName = name !== null && name !== void 0 ? name : registeredFieldName;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useIsoLayoutEffect$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useIsoLayoutEffect"])({
        "FieldRootInner.FieldRootInner.useIsoLayoutEffect": ()=>{
            if (dirtyProp !== undefined) {
                markedDirtyRef.current = dirtyProp;
            }
        }
    }["FieldRootInner.FieldRootInner.useIsoLayoutEffect"], [
        dirtyProp
    ]);
    const setDirty = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useStableCallback$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStableCallback"])({
        "FieldRootInner.FieldRootInner.useStableCallback[setDirty]": (value)=>{
            if (dirtyProp !== undefined) {
                return;
            }
            if (value) {
                markedDirtyRef.current = true;
            }
            setDirtyUnwrapped(value);
        }
    }["FieldRootInner.FieldRootInner.useStableCallback[setDirty]"]);
    const setTouched = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useStableCallback$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStableCallback"])({
        "FieldRootInner.FieldRootInner.useStableCallback[setTouched]": (value)=>{
            if (touchedProp !== undefined) {
                return;
            }
            setTouchedUnwrapped(value);
        }
    }["FieldRootInner.FieldRootInner.useStableCallback[setTouched]"]);
    const shouldValidateOnChange = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useStableCallback$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStableCallback"])({
        "FieldRootInner.FieldRootInner.useStableCallback[shouldValidateOnChange]": ()=>validationMode === 'onChange' || validationMode === 'onSubmit' && submitAttemptedRef.current
    }["FieldRootInner.FieldRootInner.useStableCallback[shouldValidateOnChange]"]);
    const formError = effectiveName && Object.hasOwn(errors, effectiveName) ? errors[effectiveName] : null;
    const hasFormError = !!(Array.isArray(formError) ? formError.length : formError);
    const invalid = invalidProp === true || hasFormError;
    const [validityData, setValidityData] = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"]({
        state: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$constants$2f$constants$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_VALIDITY_STATE"],
        error: '',
        errors: [],
        value: null,
        initialValue: null
    });
    // App-controlled invalidity (the `invalid` prop and `<Form>` errors) keeps the field marked
    // invalid even while disabled. Only computed validity (native constraints and `validate`)
    // is suppressed when disabled, matching `:disabled` not participating in constraint validation.
    const valid = !invalid && (disabled ? null : validityData.state.valid);
    const state = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"]({
        "FieldRootInner.FieldRootInner.useMemo[state]": ()=>({
                disabled,
                touched,
                dirty,
                valid,
                filled,
                focused
            })
    }["FieldRootInner.FieldRootInner.useMemo[state]"], [
        disabled,
        touched,
        dirty,
        valid,
        filled,
        focused
    ]);
    const validation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$root$2f$useFieldValidation$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useFieldValidation"])({
        setValidityData,
        validate,
        validityData,
        validationDebounceTime,
        invalid,
        markedDirtyRef,
        state,
        shouldValidateOnChange,
        registeredFieldIdRef
    });
    const [validateFieldControl, registerFieldControl] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$register$2d$control$2f$useFieldControlRegistration$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useFieldControlRegistration"])({
        commit: validation.commit,
        invalid,
        markedDirtyRef,
        name,
        setRegisteredFieldName,
        registeredFieldIdRef,
        setValidityData,
        validityData
    });
    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useImperativeHandle"](actionsRef, {
        "FieldRootInner.FieldRootInner.useImperativeHandle": ()=>({
                validate: validateFieldControl
            })
    }["FieldRootInner.FieldRootInner.useImperativeHandle"], [
        validateFieldControl
    ]);
    const contextValue = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"]({
        "FieldRootInner.FieldRootInner.useMemo[contextValue]": ()=>({
                invalid,
                name: effectiveName,
                validityData,
                setValidityData,
                disabled,
                setTouched,
                setDirty,
                setFilled,
                setFocused,
                validationMode,
                shouldValidateOnChange,
                state,
                registerFieldControl,
                validation
            })
    }["FieldRootInner.FieldRootInner.useMemo[contextValue]"], [
        invalid,
        effectiveName,
        validityData,
        disabled,
        setTouched,
        setDirty,
        setFilled,
        setFocused,
        validationMode,
        shouldValidateOnChange,
        state,
        registerFieldControl,
        validation
    ]);
    const element = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useRenderElement$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRenderElement"])('div', componentProps, {
        ref: forwardedRef,
        state,
        props: elementProps,
        stateAttributesMapping: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$constants$2f$constants$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fieldValidityMapping"]
    });
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsx"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$root$2d$context$2f$FieldRootContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FieldRootContext"].Provider, {
        value: contextValue,
        children: element
    });
});
/**
 * Groups all parts of the field.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */ if ("TURBOPACK compile-time truthy", 1) FieldRootInner.displayName = "FieldRootInner";
const FieldRoot = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](function FieldRoot(componentProps, forwardedRef) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsx"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$labelable$2d$provider$2f$LabelableProvider$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LabelableProvider"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsx"])(FieldRootInner, {
            ...componentProps,
            ref: forwardedRef
        })
    });
});
if ("TURBOPACK compile-time truthy", 1) FieldRoot.displayName = "FieldRoot";
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/utils/useRegisteredLabelId.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useRegisteredLabelId",
    ()=>useRegisteredLabelId
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useIsoLayoutEffect$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/useIsoLayoutEffect.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useBaseUiId$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/useBaseUiId.mjs [app-client] (ecmascript)");
'use client';
;
;
function useRegisteredLabelId(idProp, setLabelId) {
    const id = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useBaseUiId$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useBaseUiId"])(idProp);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useIsoLayoutEffect$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useIsoLayoutEffect"])({
        "useRegisteredLabelId.useIsoLayoutEffect": ()=>{
            setLabelId(id);
            return ({
                "useRegisteredLabelId.useIsoLayoutEffect": ()=>{
                    setLabelId({
                        "useRegisteredLabelId.useIsoLayoutEffect": (currentId)=>currentId === id ? undefined : currentId
                    }["useRegisteredLabelId.useIsoLayoutEffect"]);
                }
            })["useRegisteredLabelId.useIsoLayoutEffect"];
        }
    }["useRegisteredLabelId.useIsoLayoutEffect"], [
        id,
        setLabelId
    ]);
    return id;
}
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/labelable-provider/useLabel.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "focusElementWithVisible",
    ()=>focusElementWithVisible,
    "useLabel",
    ()=>useLabel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$floating$2d$ui$2f$utils$2f$dist$2f$floating$2d$ui$2e$utils$2e$dom$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@floating-ui/utils/dist/floating-ui.utils.dom.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$owner$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/owner.mjs [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useStableCallback$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/useStableCallback.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$shadowDom$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/shadowDom.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$utils$2f$useRegisteredLabelId$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/utils/useRegisteredLabelId.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$labelable$2d$provider$2f$LabelableContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/labelable-provider/LabelableContext.mjs [app-client] (ecmascript)");
'use client';
;
;
;
;
;
;
function useLabel() {
    let params = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    const { id: idProp, fallbackControlId, native = false, setLabelId: setLabelIdProp, focusControl: focusControlProp } = params;
    const { controlId: contextControlId, setLabelId: setContextLabelId } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$labelable$2d$provider$2f$LabelableContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLabelableContext"])();
    const syncLabelId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useStableCallback$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStableCallback"])({
        "useLabel.useStableCallback[syncLabelId]": (nextLabelId)=>{
            setContextLabelId(nextLabelId);
            setLabelIdProp === null || setLabelIdProp === void 0 ? void 0 : setLabelIdProp(nextLabelId);
        }
    }["useLabel.useStableCallback[syncLabelId]"]);
    const id = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$utils$2f$useRegisteredLabelId$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRegisteredLabelId"])(idProp, syncLabelId);
    const resolvedControlId = contextControlId !== null && contextControlId !== void 0 ? contextControlId : fallbackControlId;
    function focusControl(event) {
        if (focusControlProp) {
            focusControlProp(event, resolvedControlId);
            return;
        }
        if (!resolvedControlId) {
            return;
        }
        const controlElement = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$owner$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["ownerDocument"])(event.currentTarget).getElementById(resolvedControlId);
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$floating$2d$ui$2f$utils$2f$dist$2f$floating$2d$ui$2e$utils$2e$dom$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isHTMLElement"])(controlElement)) {
            focusElementWithVisible(controlElement);
        }
    }
    function handleInteraction(event) {
        const target = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$shadowDom$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getTarget"])(event.nativeEvent);
        if (target === null || target === void 0 ? void 0 : target.closest('button,input,select,textarea')) {
            return;
        }
        // Prevent text selection when double clicking label.
        if (!event.defaultPrevented && event.detail > 1) {
            event.preventDefault();
        }
        if (native) {
            return;
        }
        focusControl(event);
    }
    return native ? {
        id,
        htmlFor: resolvedControlId !== null && resolvedControlId !== void 0 ? resolvedControlId : undefined,
        onMouseDown: handleInteraction
    } : {
        id,
        onClick: handleInteraction,
        onPointerDown (event) {
            event.preventDefault();
        }
    };
}
function focusElementWithVisible(element) {
    element.focus({
        // Available from Chrome 144+ (January 2026).
        // Safari and Firefox already support it.
        focusVisible: true
    });
}
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/item/FieldItemContext.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FieldItemContext",
    ()=>FieldItemContext,
    "useFieldItemContext",
    ()=>useFieldItemContext
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
'use client';
;
const FieldItemContext = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"]({
    disabled: false
});
if ("TURBOPACK compile-time truthy", 1) FieldItemContext.displayName = "FieldItemContext";
function useFieldItemContext() {
    const context = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"](FieldItemContext);
    return context;
}
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/label/FieldLabel.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FieldLabel",
    ()=>FieldLabel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$error$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/error.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$safeReact$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/safeReact.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$root$2d$context$2f$FieldRootContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/field-root-context/FieldRootContext.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$constants$2f$constants$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/field-constants/constants.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useRenderElement$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/useRenderElement.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$labelable$2d$provider$2f$LabelableContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/labelable-provider/LabelableContext.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$labelable$2d$provider$2f$useLabel$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/labelable-provider/useLabel.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$item$2f$FieldItemContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/item/FieldItemContext.mjs [app-client] (ecmascript)");
'use client';
;
;
;
;
;
;
;
;
;
const FieldLabel = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](function FieldLabel(componentProps, forwardedRef) {
    const { render, className, style, id: idProp, nativeLabel = true, ...elementProps } = componentProps;
    const fieldRootContext = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$root$2d$context$2f$FieldRootContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useFieldRootContext"])(false);
    const fieldItemContext = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$item$2f$FieldItemContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useFieldItemContext"])();
    const { labelId } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$labelable$2d$provider$2f$LabelableContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLabelableContext"])();
    const state = {
        ...fieldRootContext.state,
        disabled: fieldRootContext.disabled || fieldItemContext.disabled
    };
    const labelRef = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](null);
    const labelProps = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$labelable$2d$provider$2f$useLabel$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLabel"])({
        id: labelId !== null && labelId !== void 0 ? labelId : idProp,
        native: nativeLabel
    });
    if ("TURBOPACK compile-time truthy", 1) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
            "FieldLabel.FieldLabel.useEffect": ()=>{
                if (!labelRef.current) {
                    return;
                }
                const isLabelTag = labelRef.current.tagName === 'LABEL';
                if (nativeLabel) {
                    if (!isLabelTag) {
                        var _SafeReact_captureOwnerStack;
                        const ownerStackMessage = ((_SafeReact_captureOwnerStack = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$safeReact$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SafeReact"].captureOwnerStack) === null || _SafeReact_captureOwnerStack === void 0 ? void 0 : _SafeReact_captureOwnerStack.call(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$safeReact$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SafeReact"])) || '';
                        const message = '<Field.Label> expected a <label> element because the `nativeLabel` prop is true. ' + 'Rendering a non-<label> disables native label association, so `htmlFor` will not ' + 'work. Use a real <label> in the `render` prop, or set `nativeLabel` to `false`.';
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$error$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["error"])("".concat(message).concat(ownerStackMessage));
                    }
                } else if (isLabelTag) {
                    var _SafeReact_captureOwnerStack1;
                    const ownerStackMessage = ((_SafeReact_captureOwnerStack1 = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$safeReact$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SafeReact"].captureOwnerStack) === null || _SafeReact_captureOwnerStack1 === void 0 ? void 0 : _SafeReact_captureOwnerStack1.call(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$safeReact$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SafeReact"])) || '';
                    const message = '<Field.Label> expected a non-<label> element because the `nativeLabel` prop is false. ' + 'Rendering a <label> assumes native label behavior while Base UI treats it as ' + 'non-native, which can cause unexpected pointer behavior. Use a non-<label> in the ' + '`render` prop, or set `nativeLabel` to `true`.';
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$error$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["error"])("".concat(message).concat(ownerStackMessage));
                }
            }
        }["FieldLabel.FieldLabel.useEffect"], [
            nativeLabel
        ]);
    }
    const element = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useRenderElement$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRenderElement"])('label', componentProps, {
        ref: [
            forwardedRef,
            labelRef
        ],
        state,
        props: [
            labelProps,
            elementProps
        ],
        stateAttributesMapping: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$constants$2f$constants$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fieldValidityMapping"]
    });
    return element;
});
if ("TURBOPACK compile-time truthy", 1) FieldLabel.displayName = "FieldLabel";
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/error/FieldError.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FieldError",
    ()=>FieldError
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useIsoLayoutEffect$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/useIsoLayoutEffect.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$root$2d$context$2f$FieldRootContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/field-root-context/FieldRootContext.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$labelable$2d$provider$2f$LabelableContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/labelable-provider/LabelableContext.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$constants$2f$constants$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/field-constants/constants.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$form$2d$context$2f$FormContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/form-context/FormContext.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useRenderElement$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/useRenderElement.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useBaseUiId$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/useBaseUiId.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useOpenChangeComplete$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/useOpenChangeComplete.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$stateAttributesMapping$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/stateAttributesMapping.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useTransitionStatus$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/useTransitionStatus.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
'use client';
;
;
;
;
;
;
;
;
;
;
;
;
const stateAttributesMapping = {
    ...__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$constants$2f$constants$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fieldValidityMapping"],
    ...__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$stateAttributesMapping$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["transitionStatusMapping"]
};
const FieldError = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](function FieldError(componentProps, forwardedRef) {
    const { render, id: idProp, className, match, style, ...elementProps } = componentProps;
    const id = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useBaseUiId$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useBaseUiId"])(idProp);
    const { validityData, state: fieldState, name } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$root$2d$context$2f$FieldRootContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useFieldRootContext"])(false);
    const { setMessageIds } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$labelable$2d$provider$2f$LabelableContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLabelableContext"])();
    const { errors } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$form$2d$context$2f$FormContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useFormContext"])();
    const formError = name && Object.hasOwn(errors, name) ? errors[name] : null;
    const hasFormError = !!(Array.isArray(formError) ? formError.length : formError);
    const hasSpecificMatch = typeof match === 'string';
    let rendered = false;
    if (match === true) {
        rendered = true;
    } else if (fieldState.disabled) {
        rendered = false;
    } else if (hasSpecificMatch) {
        rendered = Boolean(validityData.state[match]);
    } else {
        rendered = hasFormError || validityData.state.valid === false;
    }
    const { mounted, transitionStatus, setMounted } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useTransitionStatus$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTransitionStatus"])(rendered);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useIsoLayoutEffect$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useIsoLayoutEffect"])({
        "FieldError.FieldError.useIsoLayoutEffect": ()=>{
            if (!rendered || !id) {
                return undefined;
            }
            setMessageIds({
                "FieldError.FieldError.useIsoLayoutEffect": (v)=>v.concat(id)
            }["FieldError.FieldError.useIsoLayoutEffect"]);
            return ({
                "FieldError.FieldError.useIsoLayoutEffect": ()=>{
                    setMessageIds({
                        "FieldError.FieldError.useIsoLayoutEffect": (v)=>v.filter({
                                "FieldError.FieldError.useIsoLayoutEffect": (item)=>item !== id
                            }["FieldError.FieldError.useIsoLayoutEffect"])
                    }["FieldError.FieldError.useIsoLayoutEffect"]);
                }
            })["FieldError.FieldError.useIsoLayoutEffect"];
        }
    }["FieldError.FieldError.useIsoLayoutEffect"], [
        rendered,
        id,
        setMessageIds
    ]);
    const errorRef = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](null);
    const [lastRenderedMessage, setLastRenderedMessage] = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](null);
    const [lastRenderedMessageKey, setLastRenderedMessageKey] = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](null);
    let error = validityData.error;
    if (!hasSpecificMatch && hasFormError) {
        error = formError;
    } else if (validityData.errors.length > 1) {
        error = validityData.errors;
    }
    let errorMessage = error;
    if (Array.isArray(error)) {
        errorMessage = error.length > 1 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsx"])("ul", {
            children: error.map((message)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsx"])("li", {
                    children: message
                }, message))
        }) : error[0];
    }
    const errorKey = Array.isArray(error) ? JSON.stringify(error) : error;
    if (rendered && errorKey !== lastRenderedMessageKey) {
        setLastRenderedMessageKey(errorKey);
        setLastRenderedMessage(errorMessage);
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useOpenChangeComplete$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useOpenChangeComplete"])({
        open: rendered,
        ref: errorRef,
        onComplete () {
            if (!rendered) {
                setMounted(false);
            }
        }
    });
    const state = {
        ...fieldState,
        transitionStatus
    };
    const element = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useRenderElement$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRenderElement"])('div', componentProps, {
        ref: [
            forwardedRef,
            errorRef
        ],
        state,
        props: [
            {
                id,
                children: rendered ? errorMessage : lastRenderedMessage
            },
            elementProps
        ],
        stateAttributesMapping,
        enabled: mounted
    });
    if (!mounted) {
        return null;
    }
    return element;
});
if ("TURBOPACK compile-time truthy", 1) FieldError.displayName = "FieldError";
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/description/FieldDescription.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FieldDescription",
    ()=>FieldDescription
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useIsoLayoutEffect$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/useIsoLayoutEffect.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$root$2d$context$2f$FieldRootContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/field-root-context/FieldRootContext.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$labelable$2d$provider$2f$LabelableContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/labelable-provider/LabelableContext.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$constants$2f$constants$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/field-constants/constants.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useBaseUiId$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/useBaseUiId.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useRenderElement$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/useRenderElement.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$item$2f$FieldItemContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/item/FieldItemContext.mjs [app-client] (ecmascript)");
'use client';
;
;
;
;
;
;
;
;
const FieldDescription = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](function FieldDescription(componentProps, forwardedRef) {
    const { render, id: idProp, className, style, ...elementProps } = componentProps;
    const id = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useBaseUiId$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useBaseUiId"])(idProp);
    const fieldRootContext = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$root$2d$context$2f$FieldRootContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useFieldRootContext"])(false);
    const fieldItemContext = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$item$2f$FieldItemContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useFieldItemContext"])();
    const { setMessageIds } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$labelable$2d$provider$2f$LabelableContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLabelableContext"])();
    const state = {
        ...fieldRootContext.state,
        disabled: fieldRootContext.disabled || fieldItemContext.disabled
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useIsoLayoutEffect$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useIsoLayoutEffect"])({
        "FieldDescription.FieldDescription.useIsoLayoutEffect": ()=>{
            if (!id) {
                return undefined;
            }
            setMessageIds({
                "FieldDescription.FieldDescription.useIsoLayoutEffect": (v)=>v.concat(id)
            }["FieldDescription.FieldDescription.useIsoLayoutEffect"]);
            return ({
                "FieldDescription.FieldDescription.useIsoLayoutEffect": ()=>{
                    setMessageIds({
                        "FieldDescription.FieldDescription.useIsoLayoutEffect": (v)=>v.filter({
                                "FieldDescription.FieldDescription.useIsoLayoutEffect": (item)=>item !== id
                            }["FieldDescription.FieldDescription.useIsoLayoutEffect"])
                    }["FieldDescription.FieldDescription.useIsoLayoutEffect"]);
                }
            })["FieldDescription.FieldDescription.useIsoLayoutEffect"];
        }
    }["FieldDescription.FieldDescription.useIsoLayoutEffect"], [
        id,
        setMessageIds
    ]);
    const element = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useRenderElement$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRenderElement"])('p', componentProps, {
        ref: forwardedRef,
        state,
        props: [
            {
                id
            },
            elementProps
        ],
        stateAttributesMapping: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$constants$2f$constants$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fieldValidityMapping"]
    });
    return element;
});
if ("TURBOPACK compile-time truthy", 1) FieldDescription.displayName = "FieldDescription";
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/field-register-control/useRegisterFieldControl.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useRegisterFieldControl",
    ()=>useRegisterFieldControl
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useIsoLayoutEffect$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/useIsoLayoutEffect.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useRefWithInit$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/useRefWithInit.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$root$2d$context$2f$FieldRootContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/field-root-context/FieldRootContext.mjs [app-client] (ecmascript)");
'use client';
;
;
;
function useRegisterFieldControl(controlRef, id, value, getFormValueOverride) {
    let enabled = arguments.length > 4 && arguments[4] !== void 0 ? arguments[4] : true, name = arguments.length > 5 ? arguments[5] : void 0;
    const { registerFieldControl } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$root$2d$context$2f$FieldRootContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useFieldRootContext"])();
    const sourceRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useRefWithInit$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRefWithInit"])({
        "useRegisterFieldControl.useRefWithInit[sourceRef]": ()=>Symbol()
    }["useRegisterFieldControl.useRefWithInit[sourceRef]"]);
    // Re-register without unregistering first: re-registration with the same id updates the
    // form's fields Map entry in place, while a delete + re-add would move the field to the
    // end of the Map every time its value changes.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useIsoLayoutEffect$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useIsoLayoutEffect"])({
        "useRegisterFieldControl.useIsoLayoutEffect": ()=>{
            const source = sourceRef.current;
            if (!enabled) {
                registerFieldControl(source, undefined);
                return;
            }
            const registration = {
                controlRef,
                getValue: getFormValueOverride,
                id,
                name,
                value
            };
            registerFieldControl(source, registration);
        }
    }["useRegisterFieldControl.useIsoLayoutEffect"], [
        controlRef,
        enabled,
        getFormValueOverride,
        id,
        name,
        registerFieldControl,
        sourceRef,
        value
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useIsoLayoutEffect$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useIsoLayoutEffect"])({
        "useRegisterFieldControl.useIsoLayoutEffect": ()=>{
            const source = sourceRef.current;
            return ({
                "useRegisterFieldControl.useIsoLayoutEffect": ()=>{
                    registerFieldControl(source, undefined);
                }
            })["useRegisterFieldControl.useIsoLayoutEffect"];
        }
    }["useRegisterFieldControl.useIsoLayoutEffect"], [
        registerFieldControl,
        sourceRef
    ]);
}
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/labelable-provider/useLabelableId.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useLabelableId",
    ()=>useLabelableId
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useIsoLayoutEffect$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/useIsoLayoutEffect.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useStableCallback$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/useStableCallback.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useRefWithInit$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/useRefWithInit.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$floating$2d$ui$2f$utils$2f$dist$2f$floating$2d$ui$2e$utils$2e$dom$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@floating-ui/utils/dist/floating-ui.utils.dom.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$empty$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/empty.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useBaseUiId$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/useBaseUiId.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$labelable$2d$provider$2f$LabelableContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/labelable-provider/LabelableContext.mjs [app-client] (ecmascript)");
'use client';
;
;
;
;
;
;
;
;
function useLabelableId() {
    let params = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    const { id, implicit = false, controlRef } = params;
    const { controlId, registerControlId } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$labelable$2d$provider$2f$LabelableContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLabelableContext"])();
    const defaultId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useBaseUiId$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useBaseUiId"])(id);
    const controlIdForEffect = implicit ? controlId : undefined;
    const controlSourceRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useRefWithInit$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRefWithInit"])({
        "useLabelableId.useRefWithInit[controlSourceRef]": ()=>Symbol()
    }["useLabelableId.useRefWithInit[controlSourceRef]"]);
    const hasRegisteredRef = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](false);
    const hadExplicitIdRef = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](id != null);
    const unregisterControlId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useStableCallback$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStableCallback"])({
        "useLabelableId.useStableCallback[unregisterControlId]": ()=>{
            if (!hasRegisteredRef.current || registerControlId === __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$empty$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NOOP"]) {
                return;
            }
            hasRegisteredRef.current = false;
            registerControlId(controlSourceRef.current, undefined);
        }
    }["useLabelableId.useStableCallback[unregisterControlId]"]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useIsoLayoutEffect$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useIsoLayoutEffect"])({
        "useLabelableId.useIsoLayoutEffect": ()=>{
            if (registerControlId === __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$empty$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NOOP"]) {
                return undefined;
            }
            let nextId;
            if (implicit) {
                const elem = controlRef === null || controlRef === void 0 ? void 0 : controlRef.current;
                if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$floating$2d$ui$2f$utils$2f$dist$2f$floating$2d$ui$2e$utils$2e$dom$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isElement"])(elem) && elem.closest('label') != null) {
                    nextId = id !== null && id !== void 0 ? id : null;
                } else {
                    nextId = controlIdForEffect !== null && controlIdForEffect !== void 0 ? controlIdForEffect : defaultId;
                }
            } else if (id != null) {
                hadExplicitIdRef.current = true;
                nextId = id;
            } else if (hadExplicitIdRef.current) {
                nextId = defaultId;
            } else {
                unregisterControlId();
                return undefined;
            }
            if (nextId === undefined) {
                unregisterControlId();
                return undefined;
            }
            hasRegisteredRef.current = true;
            registerControlId(controlSourceRef.current, nextId);
            return undefined;
        }
    }["useLabelableId.useIsoLayoutEffect"], [
        id,
        controlRef,
        controlIdForEffect,
        registerControlId,
        implicit,
        defaultId,
        controlSourceRef,
        unregisterControlId
    ]);
    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "useLabelableId.useEffect": ()=>{
            return unregisterControlId;
        }
    }["useLabelableId.useEffect"], [
        unregisterControlId
    ]);
    return controlId !== null && controlId !== void 0 ? controlId : defaultId;
}
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/control/FieldControl.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FieldControl",
    ()=>FieldControl
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useControlled$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/useControlled.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useIsoLayoutEffect$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/useIsoLayoutEffect.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$owner$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/owner.mjs [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useStableCallback$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/utils/useStableCallback.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$root$2d$context$2f$FieldRootContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/field-root-context/FieldRootContext.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$register$2d$control$2f$useRegisterFieldControl$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/field-register-control/useRegisterFieldControl.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$form$2d$context$2f$FormContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/form-context/FormContext.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$labelable$2d$provider$2f$LabelableContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/labelable-provider/LabelableContext.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$labelable$2d$provider$2f$useLabelableId$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/labelable-provider/useLabelableId.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$constants$2f$constants$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/field-constants/constants.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useRenderElement$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/useRenderElement.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$createBaseUIEventDetails$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/createBaseUIEventDetails.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$reason$2d$parts$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__REASONS$3e$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/reason-parts.mjs [app-client] (ecmascript) <export * as REASONS>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$shadowDom$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/shadowDom.mjs [app-client] (ecmascript)");
'use client';
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
const FieldControl = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](function FieldControl(componentProps, forwardedRef) {
    const { render, className, id: idProp, name: nameProp, value: valueProp, disabled: disabledProp = false, onValueChange, defaultValue, autoFocus = false, style, ...elementProps } = componentProps;
    const { state: fieldState, name: fieldName, disabled: fieldDisabled, setTouched, setDirty, validityData, setFocused, setFilled, validationMode, validation } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$root$2d$context$2f$FieldRootContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useFieldRootContext"])();
    const { clearErrors } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$form$2d$context$2f$FormContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useFormContext"])();
    const disabled = fieldDisabled || disabledProp;
    const name = fieldName !== null && fieldName !== void 0 ? fieldName : nameProp;
    const state = {
        ...fieldState,
        disabled
    };
    const { labelId } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$labelable$2d$provider$2f$LabelableContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLabelableContext"])();
    const id = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$labelable$2d$provider$2f$useLabelableId$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLabelableId"])({
        id: idProp
    });
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useIsoLayoutEffect$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useIsoLayoutEffect"])({
        "FieldControl.FieldControl.useIsoLayoutEffect": ()=>{
            var _validation_inputRef_current;
            const hasExternalValue = valueProp != null;
            if (((_validation_inputRef_current = validation.inputRef.current) === null || _validation_inputRef_current === void 0 ? void 0 : _validation_inputRef_current.value) || hasExternalValue && valueProp !== '') {
                setFilled(true);
            } else if (hasExternalValue && valueProp === '') {
                setFilled(false);
            }
        }
    }["FieldControl.FieldControl.useIsoLayoutEffect"], [
        validation.inputRef,
        setFilled,
        valueProp
    ]);
    const inputRef = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useIsoLayoutEffect$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useIsoLayoutEffect"])({
        "FieldControl.FieldControl.useIsoLayoutEffect": ()=>{
            if (autoFocus && inputRef.current === (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$shadowDom$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["activeElement"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$owner$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["ownerDocument"])(inputRef.current))) {
                setFocused(true);
            }
        }
    }["FieldControl.FieldControl.useIsoLayoutEffect"], [
        autoFocus,
        setFocused
    ]);
    const [valueUnwrapped] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useControlled$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useControlled"])({
        controlled: valueProp,
        default: defaultValue,
        name: 'FieldControl',
        state: 'value'
    });
    const isControlled = valueProp !== undefined;
    const value = isControlled ? valueUnwrapped : undefined;
    const getValueFromInput = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$utils$2f$useStableCallback$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStableCallback"])({
        "FieldControl.FieldControl.useStableCallback[getValueFromInput]": ()=>{
            var _validation_inputRef_current;
            return (_validation_inputRef_current = validation.inputRef.current) === null || _validation_inputRef_current === void 0 ? void 0 : _validation_inputRef_current.value;
        }
    }["FieldControl.FieldControl.useStableCallback[getValueFromInput]"]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$register$2d$control$2f$useRegisterFieldControl$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRegisterFieldControl"])(validation.inputRef, id, value, getValueFromInput, !disabled, nameProp);
    const element = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useRenderElement$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRenderElement"])('input', componentProps, {
        ref: [
            forwardedRef,
            inputRef
        ],
        state,
        props: [
            {
                id,
                disabled,
                name,
                ref: validation.inputRef,
                'aria-labelledby': labelId,
                autoFocus,
                ...isControlled ? {
                    value
                } : {
                    defaultValue
                },
                onChange (event) {
                    const inputValue = event.currentTarget.value;
                    onValueChange === null || onValueChange === void 0 ? void 0 : onValueChange(inputValue, (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$createBaseUIEventDetails$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createChangeEventDetails"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$reason$2d$parts$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__REASONS$3e$__["REASONS"].none, event.nativeEvent));
                    var _validityData_initialValue;
                    // `validation.change` reads `markedDirtyRef`, so update dirty before validating.
                    setDirty(inputValue !== ((_validityData_initialValue = validityData.initialValue) !== null && _validityData_initialValue !== void 0 ? _validityData_initialValue : ''));
                    setFilled(inputValue !== '');
                    // Workaround for https://github.com/react/react/issues/9023
                    if (!event.nativeEvent.defaultPrevented) {
                        clearErrors(name);
                        validation.change(inputValue);
                    }
                },
                onFocus () {
                    setFocused(true);
                },
                onBlur (event) {
                    setTouched(true);
                    setFocused(false);
                    if (validationMode === 'onBlur') {
                        validation.commit(event.currentTarget.value);
                    }
                },
                onKeyDown (event) {
                    if (event.currentTarget.tagName === 'INPUT' && event.key === 'Enter') {
                        setTouched(true);
                        validation.commit(event.currentTarget.value);
                    }
                }
            },
            elementProps,
            {
                "FieldControl.FieldControl.useRenderElement[element]": (props)=>validation.getValidationProps(disabled, props)
            }["FieldControl.FieldControl.useRenderElement[element]"]
        ],
        stateAttributesMapping: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$constants$2f$constants$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fieldValidityMapping"]
    });
    return element;
});
if ("TURBOPACK compile-time truthy", 1) FieldControl.displayName = "FieldControl";
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/validity/FieldValidity.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FieldValidity",
    ()=>FieldValidity
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$root$2d$context$2f$FieldRootContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/field-root-context/FieldRootContext.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$utils$2f$getCombinedFieldValidityData$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/utils/getCombinedFieldValidityData.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useTransitionStatus$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/useTransitionStatus.mjs [app-client] (ecmascript)");
/**
 * Used to display a custom message based on the field's validity.
 * Requires `children` to be a function that accepts field validity state as an argument.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
'use client';
;
;
;
;
;
const FieldValidity = function FieldValidity(props) {
    const { children } = props;
    const { validityData, invalid } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$root$2d$context$2f$FieldRootContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useFieldRootContext"])(false);
    const combinedFieldValidityData = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"]({
        "FieldValidity.useMemo[combinedFieldValidityData]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$utils$2f$getCombinedFieldValidityData$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getCombinedFieldValidityData"])(validityData, invalid)
    }["FieldValidity.useMemo[combinedFieldValidityData]"], [
        validityData,
        invalid
    ]);
    const isInvalid = combinedFieldValidityData.state.valid === false;
    const { transitionStatus } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useTransitionStatus$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTransitionStatus"])(isInvalid);
    // `fieldValidityState` is handed straight to a public render prop, so its identity is observable:
    // consumers can pass it to a memoized child. Keep it stable across unrelated field-state changes
    // (focus, dirty, filled) so those children don't rerender when the validity itself is unchanged.
    const fieldValidityState = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"]({
        "FieldValidity.useMemo[fieldValidityState]": ()=>{
            return {
                ...combinedFieldValidityData,
                validity: combinedFieldValidityData.state,
                transitionStatus
            };
        }
    }["FieldValidity.useMemo[fieldValidityState]"], [
        combinedFieldValidityData,
        transitionStatus
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsx"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: children(fieldValidityState)
    });
};
if ("TURBOPACK compile-time truthy", 1) FieldValidity.displayName = "FieldValidity";
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/item/FieldItem.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FieldItem",
    ()=>FieldItem
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$root$2d$context$2f$FieldRootContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/field-root-context/FieldRootContext.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$constants$2f$constants$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/field-constants/constants.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useRenderElement$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/useRenderElement.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$item$2f$FieldItemContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/item/FieldItemContext.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$labelable$2d$provider$2f$LabelableProvider$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/labelable-provider/LabelableProvider.mjs [app-client] (ecmascript)");
/**
 * Groups individual items in a checkbox group or radio group with a label and description.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
'use client';
;
;
;
;
;
;
;
const FieldItem = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](function FieldItem(componentProps, forwardedRef) {
    const { render, className, style, disabled: disabledProp = false, ...elementProps } = componentProps;
    const { state: fieldState, disabled: rootDisabled } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$root$2d$context$2f$FieldRootContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useFieldRootContext"])(false);
    const disabled = rootDisabled || disabledProp;
    const state = {
        ...fieldState,
        disabled
    };
    const fieldItemContext = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"]({
        "FieldItem.FieldItem.useMemo[fieldItemContext]": ()=>({
                disabled
            })
    }["FieldItem.FieldItem.useMemo[fieldItemContext]"], [
        disabled
    ]);
    const element = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useRenderElement$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRenderElement"])('div', componentProps, {
        ref: forwardedRef,
        state,
        props: elementProps,
        stateAttributesMapping: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$field$2d$constants$2f$constants$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fieldValidityMapping"]
    });
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsx"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$labelable$2d$provider$2f$LabelableProvider$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LabelableProvider"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsx"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$item$2f$FieldItemContext$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FieldItemContext"].Provider, {
            value: fieldItemContext,
            children: element
        })
    });
});
if ("TURBOPACK compile-time truthy", 1) FieldItem.displayName = "FieldItem";
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/index.parts.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Control",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$control$2f$FieldControl$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FieldControl"],
    "Description",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$description$2f$FieldDescription$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FieldDescription"],
    "Error",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$error$2f$FieldError$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FieldError"],
    "Item",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$item$2f$FieldItem$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FieldItem"],
    "Label",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$label$2f$FieldLabel$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FieldLabel"],
    "Root",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$root$2f$FieldRoot$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FieldRoot"],
    "Validity",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$validity$2f$FieldValidity$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FieldValidity"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$index$2e$parts$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/index.parts.mjs [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$root$2f$FieldRoot$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/root/FieldRoot.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$label$2f$FieldLabel$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/label/FieldLabel.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$error$2f$FieldError$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/error/FieldError.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$description$2f$FieldDescription$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/description/FieldDescription.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$control$2f$FieldControl$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/control/FieldControl.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$validity$2f$FieldValidity$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/validity/FieldValidity.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$item$2f$FieldItem$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/item/FieldItem.mjs [app-client] (ecmascript)");
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/index.parts.mjs [app-client] (ecmascript) <export * as Field>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Field",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$index$2e$parts$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$index$2e$parts$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/index.parts.mjs [app-client] (ecmascript)");
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/input/Input.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Input",
    ()=>Input
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$index$2e$parts$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Field$3e$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/field/index.parts.mjs [app-client] (ecmascript) <export * as Field>");
/**
 * A native input element that automatically works with [Field](https://base-ui.com/react/components/field).
 * Renders an `<input>` element.
 *
 * Documentation: [Base UI Input](https://base-ui.com/react/components/input)
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
'use client';
;
;
;
const Input = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](function Input(props, forwardedRef) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsx"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$field$2f$index$2e$parts$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Field$3e$__["Field"].Control, {
        ref: forwardedRef,
        ...props
    });
});
if ("TURBOPACK compile-time truthy", 1) Input.displayName = "Input";
}),
"[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/separator/Separator.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Separator",
    ()=>Separator
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useRenderElement$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@base-ui/react/internals/useRenderElement.mjs [app-client] (ecmascript)");
'use client';
;
;
const Separator = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](function SeparatorComponent(componentProps, forwardedRef) {
    const { className, render, orientation = 'horizontal', style, ...elementProps } = componentProps;
    const state = {
        orientation
    };
    const element = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$base$2d$ui$2f$react$2f$internals$2f$useRenderElement$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRenderElement"])('div', componentProps, {
        state,
        ref: forwardedRef,
        props: [
            {
                role: 'separator',
                'aria-orientation': orientation
            },
            elementProps
        ]
    });
    return element;
});
if ("TURBOPACK compile-time truthy", 1) Separator.displayName = "Separator";
}),
]);

//# sourceMappingURL=55592_%40base-ui_react_7eba3900._.js.map