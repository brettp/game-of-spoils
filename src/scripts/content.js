var num_feed_elems = null;
var smaller_font_mode = false;
var reddit_mode = false;
var $document = $(document);
var hostname = window.location.hostname;
var hostname_dotless = hostname.replace(/\./g, '-');

async function init(settings) {
    let url = window.location.href.toLowerCase();
    let shouldBlock = await cmd('shouldBlock', url);

    if (!shouldBlock) {
        return;
    }

    console.log("Starting spoiler blocker");
    updateStyles();

    let selector = await cmd('getSelectors', url);
    initiateSpoilerBlocking(selector, false, settings);
}

(async () => {
    cmd('resetBadgePageCount');
    let settings = await cmd('getSettings');

    // wait until onload
    // @todo can get rid of this since using mutations observers?
    // Probably no. Some sites (reddit) update formatting on doc ready
    if (settings.disableOnDocReady) {
        console.log("Not waiting for doc ready");
        init(settings);
    } else {
        $(() => {
            init(settings);
        });
    }
})();

chrome.storage.onChanged.addListener((changes, namespace) => {
    // if blur spoilers is changed, remove all injected styles and add/remove no-fx
    if (changes.blurSpoilers || changes.heavyBlur || changes.hoverBlur || changes.transitionDuration) {
        if (changes.blurSpoilers) {
            if (changes.blurSpoilers.newValue) {
                $('.no-fx').removeClass('no-fx');
            } else {
                $('.glamoured-active').addClass('no-fx');
            }
        }

        updateStyles();
    }
});

// load customizable styles as vars
async function updateStyles() {
    let styles = await cmd('getVariableStyles');
    let style = document.getElementById('spoilers-injected-style');

    if (!style) {
        style = document.createElement('style');
        style.id = 'spoilers-injected-style';
        document.getElementsByTagName('head')[0].append(style);
    }

    style.textContent = `:root {
        --heavy-blur: ${styles.heavyBlur}px;
        --hover-blur: ${styles.hoverBlur}px;
        --transition-duration: ${styles.transitionDurationSecs}s;
    }`;
}

function initiateSpoilerBlocking(selector_string, remove_parent, settings) {
    searchForAndBlockSpoilers(selector_string, true, remove_parent, settings);
    var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

    var observer = new MutationObserver(helpers.debounce(function(muts, obs) {
        searchForAndBlockSpoilers(selector_string, false, remove_parent, settings);
    }, 150));

    const opts = {
        attributes: true,
        attributeOldValue: false,
        characterData: true,
        characterDataOldValue: false,
        childList: true,
        subtree: true
    };

    // @todo Can we do better than body?
    observer.observe(document.querySelector('body'), opts);
}

async function searchForAndBlockSpoilers(selector, force_update, remove_parent, settings) {
    let $items = $(selector).not('.glamoured');
    let blockedCount = 0;

    if (remove_parent) {
        $items = items.parent();
    }

    if (force_update || $items.length > 0) {
        // don't use jquery to loop because it causes
        // too many requests to the messages
        for (let i = 0; i < $items.length; i++) {
            let el = $items.get(i);
            let $el = $(el);
            // use could use innerText here because it doesn't truncate whitespace,
            // except Chrome still does enough mangling to make it useless
            // we need this so we don't get extra content appended / prepended to
            // spoilers at the start / end of nodes
            // let content = el.innerText.trim();
            let content = el.innerHTML.replace(/<[^>]+>/g, ' ');

            $el.addClass(`glamoured ${hostname_dotless}`);

            // check for spoilers and block if found
            if (content) {
                let spoilers = await cmd('hasSpoilers', content);
                if (spoilers) {
                    blockedCount++;
                    blockElement(el, spoilers[0], settings);
                }
            }
        }
    }

    if (blockedCount) {
        await cmd('incBlockCount', blockedCount);
        cmd('showCorrectBadgeCount');
    }
}

function createSpoilerInfo(spoiler, classes) {
    let h2 = document.createElement('h2');
    h2.classList = `spoiler-info ${classes}`;
    h2.innerText = `Spoiler about "${spoiler}"`;

    return h2;
}

function createContentWrapper(el) {
    let nodes = el.childNodes;
    let wrapper = document.createElement('div');
    wrapper.classList = 'content-wrapper';

    while (nodes.length > 0) {
        wrapper.appendChild(nodes[0]);
    }

    el.append(wrapper);
    return wrapper;
}

function unwrapContent(wrapped) {
    let parent = wrapped.parentNode;
    let nodes = wrapped.childNodes;

    while (nodes.length > 0) {
        parent.appendChild(nodes[0]);
    }

    wrapped.remove();
}

async function blockElement(el, blocked_word, settings) {
    let contentWrapper, info, capitalized_spoiler_words;

    if (settings.destroySpoilers) {
        el.remove();
        return;
    }

    if (!settings.blurSpoilers) {
        el.classList.add('no-fx');
    }

    // move all content into a new div so we can blur
    // but keep the info text clear without doing silly stuff
    contentWrapper = createContentWrapper(el);
    el.classList.add('glamoured-active');

    capitalized_spoiler_words = helpers.ucWords(blocked_word);

    if (settings.showSpecificSpoiler) {
        // @todo probably don't need this
        let classes = '';
        if (smaller_font_mode) {
            classes = 'small';
        }
        if (reddit_mode) {
            classes = 'redditized';
        }

        info = createSpoilerInfo(capitalized_spoiler_words, classes);
        el.prepend(info);
    }

    el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        ev.preventDefault();

        if (settings.warnBeforeReveal) {
            let specific_words_for_confirm = settings.showSpecificSpoiler ? ` about "${capitalized_spoiler_words}"` : "";
            if (!confirm(`Show spoiler${specific_words_for_confirm}?`)) {
                return;
            }
        }

        let timeout = settings.transitionDurationSecs * 1000;

        if (settings.blurSpoilers) {
            // move everything back to its original parent and remove the info
            // because it confuses some sites
            // can't listen to animation or transition end events because they aren't reliably fired
            setTimeout(() => {
                unwrapContent(contentWrapper);
                if (info) {
                    info.remove();
                }
                el.classList.remove('glamoured-active');
                el.classList.remove('revealed');
            }, timeout);

            el.classList.add('revealed');
        } else {
            unwrapContent(contentWrapper);
            if (info) {
                info.remove();
            }
            el.classList.remove('glamoured-active');
            el.classList.remove('revealed');
        }

    }, {once: true});
}