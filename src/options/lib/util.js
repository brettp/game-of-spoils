export function addFlash(el, type = 'fail') {
    el.addEventListener(
        'animationend',
        e => {
            el.classList.remove('save-fail');
            el.classList.remove('save-success');
        },
        {once: true}
    );

    el.classList.add(`save-${type}`);
}

export function regexHasError(str) {
    try {
        new RegExp(str, 'iu');
    } catch (e) {
        return e.message;
    }

    return false;
}