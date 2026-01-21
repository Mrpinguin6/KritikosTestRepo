import "./browser-polyfill.min.js";

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url) {
        updateActionForUrl(tabId, tab.url);
    }
});

browser.tabs.onActivated.addListener(({tabId}) => {
    browser.tabs.get(tabId, tab => {
        if (tab && tab.url) updateActionForUrl(tabId, tab.url);
    });
});

browser.webNavigation.onCompleted.addListener(
    async (details) => {
        try {
            await browser.storage.local.set({showTeaser: true});
            registerAIUse();
            await browser.action.setPopup({tabId: details.tabId, popup: "popup.html#teaser=1"});
            await browser.action.openPopup();
        } catch {
            console.warn("[Kritikos] openPopup failed:");
        }
    },
    {
        url: [
            {hostEquals: "chatgpt.com"},
            {hostEquals: "claude.ai"},
            {hostEquals: "gemini.google.com"},
            {hostEquals: "copilot.microsoft.com"},
            {hostEquals: "perplexity.ai"},
            {hostEquals: "you.com"},
            {hostEquals: "bard.google.com"},
            {hostEquals: "openassistant.io"},
            {hostEquals: "nat.dev"},
            {hostEquals: "humata.ai"},
            {hostEquals: "character.ai"}
        ]
    }
);

function updateActionForUrl(tabId, url) {
    // List of all AI which triggers Kritikos
    const aiDomains = [
        "chatgpt.com",
        "claude.ai",
        "gemini.google.com",
        "copilot.microsoft.com",
        "perplexity.ai",
        "you.com",
        "bard.google.com",
        "openassistant.io",
        "nat.dev",
        "humata.ai",
        "character.ai"
    ];

    const aiRegex = new RegExp(aiDomains.map(d => d.replace(/\./g, "\\.")).join("|"), "i");
    const isAI = aiRegex.test(url);
    const data = {usingAI: !!isAI};
    const tabAlarms = new Map();
    data.showTeaser = !!isAI;

    browser.storage.local.set({
        usingAI: isAI,
        showTeaser: isAI
    });
    browser.action.setPopup({
        tabId,
        popup: isAI ? "popup.html" : ""
    });
}

async function registerAIUse() {
    const now = Date.now();
    const data = await browser.storage.local.get({usageCount: 0, lastUsed: null});
    await browser.storage.local.set({
        usageCount: data.usageCount + 1,
        lastUsed: now
    });
}


