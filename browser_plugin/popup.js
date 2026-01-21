(() => {
    const $ = (sel, ctx = document) => ctx.querySelector(sel);

    const chatList = $("#chatList");
    const input = $("#messageInput");
    const composer = $("#composer");
    const sendBtn = composer.querySelector(".send-btn");
    const usageCountEl = $("#usageCount");
    const menu = $("#menu");
    const menuBtn = $("#menuBtn");
    const resetBtn = $("#resetBtn");
    const body = document.body;
    const teaserOverlay = $("#teaser");
    const teaserButton = $("#teaserButton");
    const captureModal = $("#captureModal");
    const captureText = $("#captureText");
    const captureSubmit = $("#captureSubmit");
    const hasChromeStorage = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
    const teaserFromHash = location.hash.includes("teaser=1");

    function setTeaserVisibility(show) {
        if (!teaserOverlay) return;
        if (show) {
            body.classList.add("is-teaser");
            teaserOverlay.hidden = false;
        } else {
            body.classList.remove("is-teaser");
            teaserOverlay.hidden = true;
        }
    }

    function loadTeaserState() {
        if (!teaserOverlay) return;
        if (teaserFromHash) {
            setTeaserVisibility(true);
            return;
        }
        if (!hasChromeStorage) {
            setTeaserVisibility(false);
            return;
        }
        chrome.storage.local.get({ showTeaser: false }, (data) => {
            if (chrome.runtime && chrome.runtime.lastError) {
                console.warn("[Kritikos] kan niet bepalen of AI gebruikt wordt voor pop-up:", chrome.runtime.lastError);
            }
            setTeaserVisibility(!!(data && data.showTeaser));
        });
    }

    function dismissTeaser() {
        const finish = () => {
            if (teaserFromHash) {
                location.href = "popup.html";
            } else {
                setTeaserVisibility(false);
            }
        };
        if (hasChromeStorage) {
            chrome.storage.local.set({ showTeaser: false }, () => {
                if (chrome.runtime && chrome.runtime.lastError) {
                    console.warn("[Kritikos] reset pop-up status:", chrome.runtime.lastError);
                }
                finish();
            });
        } else {
            finish();
        }
    }

    if (teaserButton) {
        teaserButton.addEventListener("click", (e) => {
            e.preventDefault();
            dismissTeaser();
        });
    }

    loadTeaserState();
    // Reageer op latere wijzigingen in opslag
    if (hasChromeStorage && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === "local" && changes.showTeaser) {
                setTeaserVisibility(!!changes.showTeaser.newValue);
            }
        });
    }

    // API instellingen
    // ENDPOINT en API_KEY komen uit endpoint.js
    const KRITIKOS_ENV =
        (typeof globalThis !== "undefined" && globalThis.KRITIKOS_ENV) ||
        {};

    const {
        ENDPOINT,
        API_KEY,
        MODEL_NAME,
        DEPLOYMENT_NAME
    } = KRITIKOS_ENV;

    // Standaard MODEL_NAME en DEPLOYMENT_NAME zijn DeepseekV3.1
    // MODEL_NAME en DEPLOYMENT_NAME uit endpoint.js hebben altijd voorrang
    // Gebruik dit als je een ander model wilt
    const _MODEL_NAME      = MODEL_NAME      || "DeepSeek-V3.1";
    const _DEPLOYMENT_NAME = DEPLOYMENT_NAME || "DeepSeek-V3.1";
    const SYSTEM_PROMPT = `Je bent Kritikos, een reflectieve, educatieve AI-chatbot die studenten helpt kritisch te reflecteren op hun inzet van generatieve AI bij schoolopdrachten. Je doelgroep bestaat uit studenten die regelmatig GenAI gebruiken, maar weinig kritisch omgaan met de gegenereerde output. Je begeleidt studenten via een vast, kort en krachtig 4-stappenmodel:  

1. Analyseer & Vraag naar Oorzaak: Je bekijkt de gedeelde prompt en output en stelt exact één directe, open vraag over de reden of het doel van deze AI-inzet (bijv. 'Waarom koos je ervoor om AI hiervoor te gebruiken?').

2. Stimuleer Reflectie: Je stelt, gebaseerd op het antwoord van de student, exact één korte, socratische reflectievraag per beurt. Kritikos stelt nooit meerdere vragen in één bericht. Elk bericht bevat maar één vraag, en wacht altijd eerst op het antwoord van de student voordat de volgende stap volgt. Zo blijft het gesprek natuurlijk, responsief en prettig in tempo.

3. Samenvatting of Tip: Je sluit af met één korte reflectiesamenvatting of een tip gericht op het reflectieproces (bijv. het belang van broncontrole, koppeling aan leerdoelen).

4. Stop direct: Na de tip of samenvatting sluit je het gesprek zonder verdere vragen of ondersteuning. Je geeft géén inhoudelijke hulp of oplossingen.

Je stijl is ondersteunend, nieuwsgierig, laagdrempelig en informeel. Je stelt motiverende vragen zonder belerend over te komen. Je stemt af op de energie en taal van de student, en zorgt dat het gesprek prettig, snel en niet-opdringerig verloopt. Kritikos is gevoelig voor signalen dat de student wil afronden en houdt het tempo vlot.

Kritikos gebruikt technieken uit reflectief luisteren (samenvattende en complexe statements), socratische vraagstelling (gericht op doel, aannames, implicaties, perspectief of informatie), en matching/mirroring (gespreksflow, toon afstemmen). Kritikos houdt rekening met deletion, generalisatie en vertekening (distortion) in gebruikersinput, maar benoemt dat niet expliciet. Kritikos stelt vragen die denkfouten verhelderen zonder te oordelen.

Kritikos is empathisch, kort van stof en gericht op het ontwikkelen van metacognitie over AI-gebruik. Kritikos vermijdt directe hulp bij inhoud, focust op bewustwording en zelfregulatie in leercontexten.`;

    const STORAGE_KEY = "kritikosState";

    // Gespreksstatus kopie in geheugen
    const messages = [];
    let firstTurn = true;
    let chatReady = false;

    // Check of er al een actieve chat is met minstens een user input
    function hasActiveChatMessages() {
        return messages.some((m) => m.role === "user");
    }

    // Toont of verbergt en schakelt de overlay van Plak hier jouw AI chat
    function updateCaptureModalVisibility() {
        if (!captureModal) return;

        const hasChat = hasActiveChatMessages();

        if (hasChat) {
            // Bestaand gesprek: verberg en uitzetten invoeroverlay
            captureModal.hidden = true;
            if (captureText) {
                captureText.value = "";
                captureText.disabled = true;
            }
            if (captureSubmit) {
                captureSubmit.disabled = true;
            }
        } else {
            // Nog geen gesprek: context overlay toestaan
            captureModal.hidden = false;
            if (captureText) {
                captureText.disabled = false;
            }
            if (captureSubmit) {
                const empty = !captureText || captureText.value.trim().length === 0;
                captureSubmit.disabled = empty;
            }
        }
    }

    // Laad opgeslagen status in geheugen en scherm
    function applyStateToUI(state) {
        // Reset status in geheugen
        messages.splice(0, messages.length);

        // Zorg dat system prompt er altijd bij staat voor het model
        if (SYSTEM_PROMPT && SYSTEM_PROMPT.trim().length > 0) {
            messages.push({ role: "system", content: SYSTEM_PROMPT });
        }

        // Herstel chat uit opslag en sla opening over die net is toegevoegd
        if (state && Array.isArray(state.messages)) {
            state.messages.forEach((m) => {
                if (!m || !m.role || !m.content) return;
                if (m.role === "system") return;
                messages.push({ role: m.role, content: m.content });
            });

            if (typeof state.firstTurn === "boolean") {
                firstTurn = state.firstTurn;
            } else {
                // Als er al een user input is, is de eerste beurt voorbij
                firstTurn = !messages.some((m) => m.role === "user");
            }
        } else {
            // Geen opgeslagen chat: vul met openingschat uit de DOM
            firstTurn = true;
            const firstBotBubble = chatList.querySelector(".msg-bot .bubble");
            if (firstBotBubble) {
                messages.push({ role: "assistant", content: firstBotBubble.textContent.trim() });
            }
        }

        // Bouw de chat in het scherm opnieuw
        chatList.innerHTML = "";
        messages.forEach((m) => {
            if (m.role === "assistant") {
                const wrap = document.createElement("div");
                wrap.className = "msg msg-bot";

                const avatar = document.createElement("div");
                avatar.className = "msg-avatar";
                avatar.innerHTML = `<img src="icons/uil.png" class="avatar-img" alt="" width="18" height="18" />`;

                const bubble = document.createElement("div");
                bubble.className = "bubble";
                bubble.textContent = m.content;

                wrap.appendChild(avatar);
                wrap.appendChild(bubble);
                chatList.appendChild(wrap);
            } else if (m.role === "user") {
                const wrap = document.createElement("div");
                wrap.className = "msg msg-user";

                const bubble = document.createElement("div");
                bubble.className = "bubble";
                bubble.textContent = m.content;

                wrap.appendChild(bubble);
                chatList.appendChild(wrap);
            }
        });

        // Als er nog geen geschiedenis is of nieuwe user input
        // geef openingschat Kritikos
        const hasVisibleMessages = messages.some(
            (m) => m.role === "assistant" || m.role === "user"
        );
        if (!hasVisibleMessages) {
            const text = "Dit is de AI-chat die je met mij deelde:";
            const wrap = document.createElement("div");
            wrap.className = "msg msg-bot";

            const avatar = document.createElement("div");
            avatar.className = "msg-avatar";
            avatar.innerHTML = `<img src="icons/uil.png" class="avatar-img" alt="" width="18" height="18" />`;

            const bubble = document.createElement("div");
            bubble.className = "bubble";
            bubble.textContent = text;

            wrap.appendChild(avatar);
            wrap.appendChild(bubble);
            chatList.appendChild(wrap);

            messages.push({ role: "assistant", content: text });
        }

        // Herstel gebruiksteller en thema indien aanwezig
        if (state && typeof state.usageCount === "number") {
            usageCountEl.textContent = String(state.usageCount);
        }
        if (state && typeof state.theme === "string") {
            document.documentElement.setAttribute("data-theme", state.theme);
        }

        chatList.scrollTop = chatList.scrollHeight;

        // Schakel de composer in
        chatReady = true;
        input.disabled = false;
        sendBtn.disabled = input.value.trim().length === 0;

        // Toon of verberg de eerste overlay Plak hier jouw AI chat op basis van chatstatus
        updateCaptureModalVisibility();
    }

    // Sla huidige status op in opslag
    function saveState() {
        const state = {
            messages,
            firstTurn,
            usageCount: parseInt(usageCountEl.textContent || "0", 10),
            theme: document.documentElement.getAttribute("data-theme") || "light",
        };

        if (hasChromeStorage) {
            chrome.storage.local.set({ [STORAGE_KEY]: state }, () => {
                if (chrome.runtime && chrome.runtime.lastError) {
                    console.warn("[Kritikos] kon chatstatus niet opslaan:", chrome.runtime.lastError);
                }
            });
        } else {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            } catch (err) {
                console.warn("[Kritikos] kon chatstatus niet opslaan in localStorage:", err);
            }
        }
    }

    // Laad status uit opslag of maak een nieuwe
    function loadState() {
        const fallback = () => {
            applyStateToUI(null);
            saveState();
        };

        if (hasChromeStorage) {
            chrome.storage.local.get({ [STORAGE_KEY]: null }, (data) => {
                if (chrome.runtime && chrome.runtime.lastError) {
                    console.warn("[Kritikos] kon chatstatus niet laden:", chrome.runtime.lastError);
                    fallback();
                    return;
                }
                applyStateToUI(data && data[STORAGE_KEY]);
            });
        } else {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) {
                    fallback();
                    return;
                }
                const state = JSON.parse(raw);
                applyStateToUI(state);
            } catch (err) {
                console.warn("[Kritikos] kon chatstatus niet laden uit localStorage:", err);
                fallback();
            }
        }
    }

    // Begin met uitgeschakelde composer tot status klaar is, laad dan status
    input.disabled = true;
    sendBtn.disabled = true;
    loadState();

    // Schakel verzendknop in of uit
    input.addEventListener("input", () => {
        sendBtn.disabled = input.value.trim().length === 0;
    });
    sendBtn.disabled = true;

    // UI hulpfuncties
    function addUserMessage(text) {
        const wrap = document.createElement("div");
        wrap.className = "msg msg-user";
        const bubble = document.createElement("div");
        bubble.className = "bubble";
        bubble.textContent = text;
        wrap.appendChild(bubble);
        chatList.appendChild(wrap);
        chatList.scrollTop = chatList.scrollHeight;
    }

    function addBotMessage(text) {
        const wrap = document.createElement("div");
        wrap.className = "msg msg-bot";
        const avatar = document.createElement("div");
        avatar.className = "msg-avatar";
        avatar.innerHTML = `<img src="icons/uil.png" class="avatar-img" alt="" width="18" height="18" />`;
        const bubble = document.createElement("div");
        bubble.className = "bubble";
        bubble.textContent = text;
        wrap.appendChild(avatar);
        wrap.appendChild(bubble);
        chatList.appendChild(wrap);
        chatList.scrollTop = chatList.scrollHeight;
    }

    function endpointPath(path) {
        const raw = (ENDPOINT || "").trim();
        if (!raw) return path; // aanroep heeft ENDPOINT al gevalideerd

        // Normaliseer ENDPOINT
        const base = raw.replace(/\/+$/, "");

        // Als ENDPOINT al naar /chat/completions wijst, niet nog eens toevoegen
        const alreadyAtChat = /\/(?:openai\/)?v\d+\/chat\/completions(\b|\/|\?)/i.test(base);
        if (alreadyAtChat) {
            return base + (path === "/chat/completions" ? "" : path);
        }

        // Detecteer Azure zoals *.openai.azure.com en *.services.ai.azure.com
        const isAzure = /\.openai\.azure\.com$/i.test(new URL(base).host) || /\.services\.ai\.azure\.com$/i.test(new URL(base).host);

        let root = base;
        if (isAzure) {
            // Geef /openai/v1 de voorkeur zodat geen api version nodig is
            if (!/\/openai\/v\d+(\/|$)/i.test(base)) {
                root = base + "/openai/v1";
            }
        } else {
            // OpenAI varianten gebruiken meestal /v1
            if (!/\/v\d+(\/|$)/i.test(base)) {
                root = base + "/v1";
            }
        }

        return root + path; // bijv. <base>/openai/v1 + "/chat/completions"
    }

    async function callModel(userText) {
        if (!ENDPOINT) {
            addBotMessage("Fout: ENDPOINT ontbreekt.");
            return;
        }
        if (!API_KEY) {
            addBotMessage("Fout: API_KEY ontbreekt.");
            return;
        }

        // Werk de status bij zodat het verzoek de user input bevat
        messages.push({ role: "user", content: userText });
        saveState();

        const url = endpointPath("/chat/completions");
        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${API_KEY}`
        };

        try {
            const res = await fetch(url, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    model: _DEPLOYMENT_NAME,
                    messages,
                    stream: false
                }),
            });

            if (!res.ok) {
                let detail = "";
                try {
                    const j = await res.json();
                    detail = JSON.stringify(j);
                } catch {
                    const t = await res.text().catch(() => "");
                    detail = t;
                }
                throw new Error(`HTTP ${res.status} ${res.statusText}${detail ? " - " + detail : ""}`);
            }

            const data = await res.json();
            const assistantText =
                (data &&
                    data.choices &&
                    data.choices[0] &&
                    data.choices[0].message &&
                    data.choices[0].message.content) ||
                "(Leeg antwoord)";

            // Voeg assistentbericht toe aan status en UI
            messages.push({ role: "assistant", content: assistantText });
            addBotMessage(assistantText);
            saveState();
        } catch (err) {
            console.error(err);
            addBotMessage(`Fout bij modelaanroep: ${err.message || err}`);
            saveState();
        }
    }

    // Bericht versturen
    composer.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!chatReady) return;

        const text = input.value.trim();
        if (!text) return;

        addUserMessage(text);
        input.value = "";
        sendBtn.disabled = true;

        // Geef context aan het model over de invoer
        if (firstTurn) {
            const contextMsg =
                "Hier is de door de student gedeelde AI-interactie (prompt + output). " +
                "Gebruik dit als context om stap 1 te starten (exact één open vraag over het doel/reden):\n\n" +
                text;
            callModel(contextMsg);
            firstTurn = false;
        } else {
            // Gesprek
            callModel(text);
        }
    });

    // Capture overlay voor prompt en output
    if (captureModal && captureText && captureSubmit) {
        // Knop uit tot er tekst staat en overlay actief is
        const setCaptureBtnState = () => {
            const empty = captureText.value.trim().length === 0;
            captureSubmit.disabled = captureText.disabled || empty;
        };
        setCaptureBtnState();
        captureText.addEventListener("input", setCaptureBtnState);

        const handleCaptureSubmit = async (e) => {
            e.preventDefault();
            if (!chatReady) return;

            const raw = captureText.value.trim();
            if (!raw) {
                captureText.focus();
                return;
            }

            // Verberg de overlay direct zodat de chat zichtbaar is
            captureModal.hidden = true;

            // Zet de geplakte invoer van de gebruiker in de chat
            addUserMessage(raw);

            // Start de eerste beurt met dezelfde context als composer/firstTurn
            const contextMsg =
                "Hier is de door de student gedeelde AI-interactie (prompt + output). " +
                "Gebruik dit als context om stap 1 te starten (exact één open vraag over het doel/reden):\n\n" +
                raw;

            await callModel(contextMsg);
            firstTurn = false;
            saveState();

            // Nu er een chat is, verberg en blokkeer de capture overlay blijvend
            updateCaptureModalVisibility();

            // Focus de composer voor de volgende invoer
            input.focus();
        };

        captureSubmit.addEventListener("click", handleCaptureSubmit);
        // Sta Cmd/Ctrl+Enter toe in de textarea
        captureText.addEventListener("keydown", (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                handleCaptureSubmit(e);
            }
        });
    }

    function resetChat() {
        const state = {
            messages: [],
            firstTurn: true,
            usageCount: parseInt(usageCountEl.textContent || "0", 10),
            theme: document.documentElement.getAttribute("data-theme") || "light",
        };
        applyStateToUI(state);
        saveState();
    }

    // Menu logica
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            resetChat();
        });
    }

    menuBtn.addEventListener("click", () => {
        const isHidden = menu.hasAttribute("hidden");
        if (isHidden) {
            menu.removeAttribute("hidden");
        } else {
            menu.setAttribute("hidden", "");
        }
    });
    document.addEventListener("click", (e) => {
        if (!menu.contains(e.target) && e.target !== menuBtn) {
            menu.setAttribute("hidden", "");
        }
    });

    menu.addEventListener("click", (e) => {
        const btn = e.target.closest(".menu-item");
        if (!btn) return;
        const action = btn.dataset.action;

        if (action === "reset") {
            resetChat();
        }
        if (action === "add") {
            const current = parseInt(usageCountEl.textContent || "0", 10);
            usageCountEl.textContent = String(current + 1);
            saveState();
        }
        if (action === "theme") {
            const root = document.documentElement;
            const dark = root.getAttribute("data-theme") === "dark";
            root.setAttribute("data-theme", dark ? "light" : "dark");
            saveState();
        }

        menu.setAttribute("hidden", "");
    });
})();