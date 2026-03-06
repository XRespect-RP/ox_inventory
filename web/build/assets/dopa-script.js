/* ============================================
   XRESPECT INVENTORY - SCRIPT
   Compatible with FiveM / Qbox / ox_inventory
   GPU-accelerated drag, rAF loop, zero-lag
   ============================================ */

(function () {
    'use strict';

    // ========== CONFIGURATION ==========
    var CONFIG = {
        playerSlots: 42,
        secondarySlots: 42,
        maxWeight: 120,
        secondaryMaxWeight: 120,
        imagePath: 'nui://ox_inventory/web/images/',
        particleCount: 18,
        isBrowser: !window.invokeNative,
        dragThreshold: 4
    };

    // ========== STATE ==========
    var state = {
        isOpen: false,
        playerInventory: [],
        secondaryInventory: [],
        secondaryType: 'other',
        searchPlayer: '',
        searchSecondary: '',
        selectedSlot: null,
        selectedInventory: null,
        dragSlot: null,
        dragInventory: null,
        dragItem: null,
        isDragging: false,
        mouseX: 0,
        mouseY: 0,
        rafId: null,
        ghostNeedsUpdate: false,
        giveModalOpen: false,
        giveLoading: false,
        giveSubmitting: false,
        giveTargets: [],
        giveSelection: 0,
        pendingGive: null,
        giveRequestId: 0
    };

    function toArray(items) {
        if (!items) return [];
        if (Array.isArray(items)) return items.filter(Boolean);
        var arr = [];
        for (var k in items) {
            if (Object.prototype.hasOwnProperty.call(items, k) && items[k]) arr.push(items[k]);
        }
        return arr;
    }

    function upsertItem(items, newItem) {
        if (!newItem || !newItem.slot) return;
        for (var i = 0; i < items.length; i++) {
            if (items[i].slot === newItem.slot) {
                if (!newItem.count || newItem.count <= 0) {
                    items.splice(i, 1);
                } else {
                    items[i] = newItem;
                }
                return;
            }
        }
        if (newItem.count && newItem.count > 0) items.push(newItem);
    }

    // ========== DOM ELEMENTS ==========
    var $ = function (id) { return document.getElementById(id); };
    var container = $('inventory-container');
    var playerSlotsEl = $('player-slots');
    var secondarySlotsEl = $('secondary-slots');
    var playerWeightBar = $('player-weight-bar');
    var playerWeightGlow = $('player-weight-glow');
    var playerWeightText = $('player-weight-text');
    var playerWeightMax = $('player-weight-max');
    var secondaryWeightBar = $('secondary-weight-bar');
    var secondaryWeightGlow = $('secondary-weight-glow');
    var secondaryWeightText = $('secondary-weight-text');
    var secondaryWeightMax = $('secondary-weight-max');
    var playerNameEl = $('player-name');
    var playerIdEl = $('player-id');
    var secondaryNameEl = $('secondary-name');
    var secondaryIdEl = $('secondary-id');
    var tooltipEl = $('item-tooltip');
    var tooltipName = $('tooltip-name');
    var tooltipRarity = $('tooltip-rarity');
    var tooltipDesc = $('tooltip-desc');
    var tooltipWeight = $('tooltip-weight');
    var tooltipAmount = $('tooltip-amount');
    var contextMenu = $('context-menu');
    var dragGhost = $('drag-ghost');
    var dragGhostImg = $('drag-ghost-img');
    var dragGhostCount = $('drag-ghost-count');
    var closeBtn = $('close-btn');
    var actionAmount = $('action-amount');
    var btnUse = $('btn-use');
    var btnGive = $('btn-give');
    var btnDrop = $('btn-drop');
    var btnInfo = $('btn-info');
    var playerSearch = $('player-search');
    var secondarySearch = $('secondary-search');
    var toastContainer = $('toast-container');
    var particlesEl = $('particles');
    var giveModal = $('give-modal');
    var giveModalSubtitle = $('give-modal-subtitle');
    var giveItemName = $('give-item-name');
    var giveItemCount = $('give-item-count');
    var giveTargetList = $('give-target-list');

    // ========== DEMO DATA ==========
    var DEMO_ITEMS = [
        { slot: 1, name: 'water', label: 'Water Bottle', count: 3, weight: 500, description: 'A refreshing bottle of purified water.', rarity: 'common', durability: null, metadata: {} },
        { slot: 2, name: 'bread', label: 'Bread', count: 5, weight: 300, description: 'Freshly baked bread for sustenance.', rarity: 'common', durability: null, metadata: {} },
        { slot: 3, name: 'bandage', label: 'Bandage', count: 10, weight: 100, description: 'Basic medical bandage for treating wounds.', rarity: 'uncommon', durability: null, metadata: {} },
        { slot: 4, name: 'lockpick', label: 'Lockpick', count: 2, weight: 200, description: 'A thin metal tool used to pick locks.', rarity: 'rare', durability: 75, metadata: {} },
        { slot: 5, name: 'radio', label: 'Radio', count: 1, weight: 1000, description: 'Portable radio for communication.', rarity: 'uncommon', durability: 100, metadata: {} },
        { slot: 7, name: 'phone', label: 'Phone', count: 1, weight: 400, description: 'A modern smartphone with various apps.', rarity: 'rare', durability: 90, metadata: {} },
        { slot: 8, name: 'id_card', label: 'ID Card', count: 1, weight: 0, description: 'Your personal identification card.', rarity: 'common', durability: null, metadata: {} },
        { slot: 10, name: 'armor', label: 'Body Armor', count: 1, weight: 5000, description: 'Protective body armor for dangerous situations.', rarity: 'epic', durability: 65, metadata: {} },
        { slot: 12, name: 'medkit', label: 'Medical Kit', count: 2, weight: 1500, description: 'Advanced medical kit with all necessities.', rarity: 'epic', durability: null, metadata: {} },
        { slot: 15, name: 'ammo_pistol', label: 'Pistol Ammo', count: 60, weight: 200, description: '9mm ammunition rounds.', rarity: 'uncommon', durability: null, metadata: {} },
        { slot: 20, name: 'diamond', label: 'Diamond', count: 1, weight: 100, description: 'A flawless cut diamond of exceptional quality.', rarity: 'legendary', durability: null, metadata: {} },
        { slot: 22, name: 'weapon_pistol', label: 'Pistol', count: 1, weight: 2000, description: 'A standard 9mm pistol.', rarity: 'rare', durability: 88, metadata: { serial: 'DPA-4821' } },
        { slot: 30, name: 'burger', label: 'Burger', count: 2, weight: 400, description: 'A tasty fast food burger.', rarity: 'common', durability: null, metadata: {} }
    ];

    var DEMO_SECONDARY = [
        { slot: 1, name: 'iron', label: 'Iron Ore', count: 15, weight: 800, description: 'Raw iron ore from the mines.', rarity: 'common', durability: null, metadata: {} },
        { slot: 3, name: 'copper', label: 'Copper Wire', count: 8, weight: 300, description: 'Thin copper wire for electronics.', rarity: 'uncommon', durability: null, metadata: {} },
        { slot: 5, name: 'gold_bar', label: 'Gold Bar', count: 2, weight: 2000, description: 'A solid bar of pure gold.', rarity: 'legendary', durability: null, metadata: {} },
        { slot: 8, name: 'screwdriver', label: 'Screwdriver', count: 1, weight: 300, description: 'A flathead screwdriver.', rarity: 'common', durability: 60, metadata: {} }
    ];

    var DEMO_GIVE_TARGETS = [
        { id: 12, label: '[12] Mike', distance: 1.1 },
        { id: 24, label: '[24] Sarah', distance: 1.8 },
        { id: 37, label: '[37] Alex', distance: 2.4 }
    ];

    // ========== PARTICLES (lightweight) ==========
    function createParticles() {
        particlesEl.innerHTML = '';
        for (var i = 0; i < CONFIG.particleCount; i++) {
            var p = document.createElement('div');
            p.className = 'particle';
            p.style.left = Math.random() * 100 + '%';
            p.style.animationDuration = (10 + Math.random() * 14) + 's';
            p.style.animationDelay = Math.random() * 8 + 's';
            var sz = (1 + Math.random() * 1.5) + 'px';
            p.style.width = sz;
            p.style.height = sz;
            particlesEl.appendChild(p);
        }
    }

    // ========== TOAST ==========
    function showToast(message, type) {
        type = type || 'info';
        var toast = document.createElement('div');
        toast.className = 'toast toast-' + type;

        var icons = {
            success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };

        toast.innerHTML = (icons[type] || icons.info) + '<span>' + message + '</span>';
        toastContainer.appendChild(toast);

        setTimeout(function () {
            toast.classList.add('toast-exit');
            setTimeout(function () {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 260);
        }, 2500);
    }

    // ========== SLOT GENERATION ==========
    function generateSlots(containerEl, slotCount, inventoryType) {
        containerEl.innerHTML = '';
        var frag = document.createDocumentFragment();
        for (var i = 1; i <= slotCount; i++) {
            var slot = document.createElement('div');
            slot.className = 'inv-slot slot-empty';
            slot.dataset.slot = i;
            slot.dataset.inventory = inventoryType;
            slot.style.animationDelay = (i * 0.01) + 's';

            var numEl = document.createElement('span');
            numEl.className = 'slot-number';
            numEl.textContent = i;
            slot.appendChild(numEl);

            slot.addEventListener('mouseenter', onSlotHover);
            slot.addEventListener('mouseleave', onSlotLeave);
            slot.addEventListener('mousedown', onSlotMouseDown);
            slot.addEventListener('contextmenu', onSlotContextMenu);

            frag.appendChild(slot);
        }
        containerEl.appendChild(frag);
    }

    // ========== UPDATE SLOTS ==========
    function updateSlots(containerEl, items, inventoryType) {
        var slots = containerEl.querySelectorAll('.inv-slot');
        for (var s = 0; s < slots.length; s++) {
            var slot = slots[s];
            var slotNum = parseInt(slot.dataset.slot);
            var item = null;
            for (var j = 0; j < items.length; j++) {
                if (items[j].slot === slotNum) { item = items[j]; break; }
            }

            // Clear existing content except slot number
            while (slot.children.length > 1) {
                slot.removeChild(slot.lastChild);
            }

            if (item) {
                slot.classList.remove('slot-empty');
                slot.classList.add('slot-filled');
                slot.dataset.item = JSON.stringify(item);

                // Legendary shimmer
                if (item.rarity === 'legendary') {
                    slot.classList.add('slot-legendary-shimmer');
                } else {
                    slot.classList.remove('slot-legendary-shimmer');
                }

                // Image
                var img = document.createElement('img');
                img.className = 'slot-image';
                img.alt = item.label;
                img.loading = 'lazy';
                img.decoding = 'async';
                applyItemImage(img, item);
                slot.appendChild(img);

                // Count
                if (item.count > 1) {
                    var countEl = document.createElement('span');
                    countEl.className = 'slot-count';
                    countEl.textContent = 'x' + item.count;
                    slot.appendChild(countEl);
                }

                // Name
                var nameEl = document.createElement('span');
                nameEl.className = 'slot-name';
                nameEl.textContent = item.label;
                slot.appendChild(nameEl);

                // Weight
                var weightEl = document.createElement('span');
                weightEl.className = 'slot-weight';
                weightEl.textContent = formatWeight(item.weight * item.count);
                slot.appendChild(weightEl);

                // Rarity bar
                var rarityBar = document.createElement('div');
                rarityBar.className = 'slot-rarity-bar';
                var rc = getRarityColor(item.rarity);
                rarityBar.style.background = rc;
                rarityBar.style.color = rc;
                slot.appendChild(rarityBar);

                // Durability
                if (item.durability !== null && item.durability !== undefined) {
                    var durC = document.createElement('div');
                    durC.className = 'slot-durability';
                    var durF = document.createElement('div');
                    durF.className = 'slot-durability-fill';
                    durF.style.width = item.durability + '%';
                    if (item.durability > 60) durF.classList.add('durability-high');
                    else if (item.durability > 30) durF.classList.add('durability-mid');
                    else durF.classList.add('durability-low');
                    durC.appendChild(durF);
                    slot.appendChild(durC);
                }

                // Hotbar (slots 1-5 player only)
                if (inventoryType === 'player' && slotNum <= 5) {
                    var hb = document.createElement('span');
                    hb.className = 'slot-hotbar';
                    hb.textContent = slotNum;
                    slot.appendChild(hb);
                }
            } else {
                slot.classList.add('slot-empty');
                slot.classList.remove('slot-filled', 'slot-legendary-shimmer');
                delete slot.dataset.item;
            }
        }
    }

    // ========== WEIGHT ==========
    function updateWeight(inventoryType) {
        var items = inventoryType === 'player' ? state.playerInventory : state.secondaryInventory;
        var maxW = inventoryType === 'player' ? CONFIG.maxWeight : CONFIG.secondaryMaxWeight;
        var total = 0;
        for (var i = 0; i < items.length; i++) {
            total += items[i].weight * items[i].count;
        }

        var kg = (total / 1000).toFixed(1);
        var pct = Math.min((total / (maxW * 1000)) * 100, 100);

        if (inventoryType === 'player') {
            playerWeightText.textContent = kg;
            playerWeightMax.textContent = maxW;
            playerWeightBar.style.width = pct + '%';
            playerWeightGlow.style.width = pct + '%';
            if (pct > 90) {
                playerWeightBar.classList.add('overweight');
                playerWeightGlow.classList.add('overweight');
            } else {
                playerWeightBar.classList.remove('overweight');
                playerWeightGlow.classList.remove('overweight');
            }
        } else {
            secondaryWeightText.textContent = kg;
            secondaryWeightMax.textContent = maxW;
            secondaryWeightBar.style.width = pct + '%';
            secondaryWeightGlow.style.width = pct + '%';
        }
    }

    // ========== HELPERS ==========
    function formatWeight(g) {
        return g >= 1000 ? (g / 1000).toFixed(1) + ' kg' : g + 'g';
    }

    function getRarityColor(r) {
        var c = {
            common: 'rgba(200, 210, 220, 0.45)',
            uncommon: 'rgba(105, 219, 124, 0.45)',
            rare: 'rgba(120, 170, 255, 0.45)',
            epic: 'rgba(180, 130, 255, 0.45)',
            legendary: 'rgba(255, 212, 59, 0.5)'
        };
        return c[r] || c.common;
    }

    function getRarityLabel(r) {
        var l = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
        return l[r] || 'Common';
    }

    function getRarityBgColor(r) {
        var c = {
            common: 'rgba(200, 210, 220, 0.18)',
            uncommon: 'rgba(105, 219, 124, 0.18)',
            rare: 'rgba(120, 170, 255, 0.18)',
            epic: 'rgba(180, 130, 255, 0.18)',
            legendary: 'rgba(255, 212, 59, 0.18)'
        };
        return c[r] || c.common;
    }

    function normalizeImagePath(path) {
        if (!path) return '';
        var p = String(path).trim().replace(/\\/g, '/');
        if (!p) return '';

        if (p.indexOf('nui://') === 0 || p.indexOf('http://') === 0 || p.indexOf('https://') === 0 || p.indexOf('data:') === 0) {
            return p;
        }

        if (p.charAt(0) === '/') p = p.slice(1);
        if (p.indexOf('./') === 0) p = p.slice(2);
        if (p.indexOf('images/') === 0) p = p.slice('images/'.length);

        var base = CONFIG.imagePath || 'nui://ox_inventory/web/images/';
        if (base.charAt(base.length - 1) !== '/') base += '/';
        return base + p;
    }

    function buildItemImageCandidates(item) {
        var values = [];
        if (item && item.image) values.push(item.image);
        if (item && item.metadata && item.metadata.image) values.push(item.metadata.image);
        if (item && item.name) {
            values.push(item.name);
            values.push(String(item.name).toLowerCase());
            values.push(String(item.name).toUpperCase());
        }

        var out = [];
        var seen = {};
        for (var i = 0; i < values.length; i++) {
            var v = values[i];
            if (!v) continue;
            var text = String(v).trim();
            if (!text) continue;

            var hasExt = /\.[a-z0-9]+$/i.test(text);
            var options = hasExt ? [text] : [text + '.png', text + '.webp', text + '.jpg', text + '.jpeg'];

            for (var j = 0; j < options.length; j++) {
                var candidate = normalizeImagePath(options[j]);
                if (!candidate || seen[candidate]) continue;
                seen[candidate] = true;
                out.push(candidate);
            }
        }

        if (CONFIG.isBrowser && item && item.name) {
            var demo = 'https://raw.githubusercontent.com/overextended/ox_inventory/main/web/images/' + item.name + '.png';
            if (!seen[demo]) out.push(demo);
        }

        return out;
    }

    function applyItemImage(imgEl, item) {
        var candidates = buildItemImageCandidates(item);
        if (!candidates.length) {
            imgEl.style.display = 'none';
            imgEl.removeAttribute('src');
            return;
        }

        var idx = 0;
        imgEl.style.display = '';
        imgEl.onerror = function () {
            if (idx >= candidates.length) {
                imgEl.onerror = null;
                imgEl.style.display = 'none';
                imgEl.removeAttribute('src');
                return;
            }
            imgEl.src = candidates[idx++];
        };
        imgEl.src = candidates[idx++];
    }

    // ========== TOOLTIP ==========
    function showTooltip(item, x, y) {
        tooltipName.textContent = item.label;
        tooltipRarity.textContent = getRarityLabel(item.rarity);
        tooltipRarity.style.background = getRarityBgColor(item.rarity);
        tooltipDesc.textContent = item.description || 'No description available.';
        tooltipWeight.textContent = formatWeight(item.weight * item.count);
        tooltipAmount.textContent = 'x' + item.count;

        tooltipEl.classList.remove('hidden');
        positionTooltip(x, y);
    }

    function positionTooltip(x, y) {
        var rect = tooltipEl.getBoundingClientRect();
        var nx = x + 14;
        var ny = y + 10;
        if (nx + rect.width > window.innerWidth - 8) nx = x - rect.width - 14;
        if (ny + rect.height > window.innerHeight - 8) ny = y - rect.height - 10;
        tooltipEl.style.left = nx + 'px';
        tooltipEl.style.top = ny + 'px';
    }

    function hideTooltip() {
        tooltipEl.classList.add('hidden');
    }

    // ========== CONTEXT MENU ==========
    function showContextMenu(x, y) {
        contextMenu.classList.remove('hidden');
        var w = 160;
        var h = contextMenu.getBoundingClientRect().height || 130;
        contextMenu.style.left = (x + w > window.innerWidth ? x - w : x) + 'px';
        contextMenu.style.top = (y + h > window.innerHeight ? y - h : y) + 'px';
    }

    function hideContextMenu() {
        contextMenu.classList.add('hidden');
    }

    // ========== RIPPLE EFFECT ==========
    function createRipple(slot, e) {
        var rect = slot.getBoundingClientRect();
        var rip = document.createElement('div');
        rip.className = 'slot-ripple';
        var size = Math.max(rect.width, rect.height);
        rip.style.width = size + 'px';
        rip.style.height = size + 'px';
        rip.style.left = (e.clientX - rect.left - size / 2) + 'px';
        rip.style.top = (e.clientY - rect.top - size / 2) + 'px';
        slot.appendChild(rip);
        setTimeout(function () { if (rip.parentNode) rip.parentNode.removeChild(rip); }, 500);
    }

    // ========== SLOT EVENTS ==========
    function onSlotHover(e) {
        if (state.isDragging) return;
        var slot = e.currentTarget;
        if (slot.dataset.item) {
            var item = JSON.parse(slot.dataset.item);
            showTooltip(item, e.clientX, e.clientY);
        }
    }

    function onSlotLeave() {
        hideTooltip();
    }

    function onSlotMouseDown(e) {
        if (e.button !== 0) return;
        var slot = e.currentTarget;
        if (!slot.dataset.item) return;

        var item = JSON.parse(slot.dataset.item);
        state.dragSlot = parseInt(slot.dataset.slot);
        state.dragInventory = slot.dataset.inventory;
        state.dragItem = item;

        clearSelection();
        slot.classList.add('slot-selected');
        state.selectedSlot = state.dragSlot;
        state.selectedInventory = state.dragInventory;

        createRipple(slot, e);
        hideTooltip();
        hideContextMenu();

        var startX = e.clientX;
        var startY = e.clientY;

        function onMove(ev) {
            var dx = ev.clientX - startX;
            var dy = ev.clientY - startY;
            if (Math.abs(dx) > CONFIG.dragThreshold || Math.abs(dy) > CONFIG.dragThreshold) {
                if (!state.isDragging) {
                    state.isDragging = true;
                    slot.classList.add('slot-dragging');
                    startDragGhost(item);
                }
                state.mouseX = ev.clientX;
                state.mouseY = ev.clientY;
                state.ghostNeedsUpdate = true;
                updateDragOver(ev);
            }
        }

        function onUp(ev) {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if (state.isDragging) {
                endDrag(ev);
            }
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    function onSlotContextMenu(e) {
        e.preventDefault();
        var slot = e.currentTarget;
        if (!slot.dataset.item) return;

        clearSelection();
        slot.classList.add('slot-selected');
        state.selectedSlot = parseInt(slot.dataset.slot);
        state.selectedInventory = slot.dataset.inventory;

        hideTooltip();
        showContextMenu(e.clientX, e.clientY);
    }

    // ========== DRAG & DROP (rAF-based) ==========
    function startDragGhost(item) {
        dragGhost.classList.remove('hidden');
        applyItemImage(dragGhostImg, item);
        dragGhostCount.textContent = 'x' + item.count;
        dragGhostImg.style.display = '';

        // Position immediately at cursor
        var hw = dragGhost.offsetWidth / 2 || 30;
        var hh = dragGhost.offsetHeight / 2 || 30;
        dragGhost.style.left = (state.mouseX - hw) + 'px';
        dragGhost.style.top = (state.mouseY - hh) + 'px';

        startGhostLoop();
    }

    function startGhostLoop() {
        function loop() {
            if (!state.isDragging) return;
            if (state.ghostNeedsUpdate) {
                var hw = dragGhost.offsetWidth / 2;
                var hh = dragGhost.offsetHeight / 2;
                dragGhost.style.left = (state.mouseX - hw) + 'px';
                dragGhost.style.top = (state.mouseY - hh) + 'px';
                state.ghostNeedsUpdate = false;
            }
            state.rafId = requestAnimationFrame(loop);
        }
        state.rafId = requestAnimationFrame(loop);
    }

    function updateDragOver(e) {
        var overs = document.querySelectorAll('.slot-drag-over');
        for (var i = 0; i < overs.length; i++) overs[i].classList.remove('slot-drag-over');
        setGiveButtonDropState(false);

        var target = document.elementFromPoint(e.clientX, e.clientY);
        if (target) {
            var slot = target.closest('.inv-slot');
            if (slot && !(slot.dataset.inventory === state.dragInventory && parseInt(slot.dataset.slot) === state.dragSlot)) {
                slot.classList.add('slot-drag-over');
                return;
            }

            if (state.dragInventory === 'player' && target.closest('#btn-give')) {
                setGiveButtonDropState(true);
            }
        }
    }

    function endDrag(e) {
        state.isDragging = false;
        if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }

        dragGhost.classList.add('hidden');
        dragGhost.style.left = '';
        dragGhost.style.top = '';

        var dragging = document.querySelectorAll('.slot-dragging');
        for (var i = 0; i < dragging.length; i++) dragging[i].classList.remove('slot-dragging');
        var overs = document.querySelectorAll('.slot-drag-over');
        for (var j = 0; j < overs.length; j++) overs[j].classList.remove('slot-drag-over');
        setGiveButtonDropState(false);

        var target = document.elementFromPoint(e.clientX, e.clientY);
        if (target) {
            var targetSlot = target.closest('.inv-slot');
            if (targetSlot) {
                var toSlot = parseInt(targetSlot.dataset.slot);
                var toInv = targetSlot.dataset.inventory;
                if (toSlot !== state.dragSlot || toInv !== state.dragInventory) {
                    moveItem(state.dragInventory, state.dragSlot, toInv, toSlot);
                }
            } else if (state.dragInventory === 'player' && target.closest('#btn-give')) {
                openGiveModalForItem(state.dragItem, state.dragSlot, state.dragInventory, getActionAmount(state.dragItem.count));
            }
        }

        state.dragSlot = null;
        state.dragInventory = null;
        state.dragItem = null;
    }

    // ========== MOVE ITEM ==========
    function moveItem(fromInv, fromSlot, toInv, toSlot) {
        var secondaryType = state.secondaryType || 'other';
        if (secondaryType === 'drop') secondaryType = 'newdrop';
        var isShop = secondaryType === 'shop';

        var fromItems = fromInv === 'player' ? state.playerInventory : state.secondaryInventory;
        var toItems = toInv === 'player' ? state.playerInventory : state.secondaryInventory;

        var itemIdx = -1;
        for (var i = 0; i < fromItems.length; i++) {
            if (fromItems[i].slot === fromSlot) { itemIdx = i; break; }
        }
        if (itemIdx === -1) return;

        var item = fromItems[itemIdx];
        var targetIdx = -1;
        for (var k = 0; k < toItems.length; k++) {
            if (toItems[k].slot === toSlot) { targetIdx = k; break; }
        }

        var amount = parseInt(actionAmount.value, 10);
        if (!Number.isFinite(amount) || amount < 1) {
            amount = (isShop && fromInv !== 'player') ? 1 : item.count;
        }
        if (amount > item.count) amount = item.count;
        if (!Number.isFinite(amount) || amount < 1) amount = 1;

        // Shop purchases must be server-driven; don't do optimistic local moves.
        if (isShop) {
            if (!CONFIG.isBrowser) {
                if (fromInv !== 'player' && toInv === 'player') {
                    fetchNUI('buyItem', {
                        fromType: secondaryType,
                        toType: 'player',
                        fromSlot: fromSlot,
                        toSlot: toSlot,
                        count: amount
                    });
                } else {
                    showToast('You cannot move items into the shop', 'error');
                }
            }
            return;
        }

        // Check weight capacity when moving between inventories
        if (fromInv !== toInv && targetIdx === -1) {
            var toMaxW = toInv === 'player' ? CONFIG.maxWeight : CONFIG.secondaryMaxWeight;
            var currentToW = 0;
            for (var w = 0; w < toItems.length; w++) {
                currentToW += toItems[w].weight * toItems[w].count;
            }
            if (currentToW + (item.weight * amount) > toMaxW * 1000) {
                showToast('Not enough capacity!', 'error');
                return;
            }
        }

        if (targetIdx !== -1) {
            var targetItem = toItems[targetIdx];
            if (targetItem.name === item.name) {
                // Stack
                targetItem.count += amount;
                if (amount >= item.count) {
                    fromItems.splice(itemIdx, 1);
                } else {
                    item.count -= amount;
                }
            } else {
                // Swap
                var tempSlot = item.slot;
                item.slot = targetItem.slot;
                targetItem.slot = tempSlot;

                if (fromInv !== toInv) {
                    fromItems.splice(itemIdx, 1);
                    var ti = toItems.indexOf(targetItem);
                    toItems.splice(ti, 1);
                    fromItems.push(targetItem);
                    toItems.push(item);
                }
            }
        } else {
            // Move to empty slot
            if (amount >= item.count) {
                fromItems.splice(itemIdx, 1);
                item.slot = toSlot;
                toItems.push(item);
            } else {
                // Split stack
                item.count -= amount;
                var newItem = {};
                for (var key in item) {
                    if (item.hasOwnProperty(key)) newItem[key] = item[key];
                }
                newItem.slot = toSlot;
                newItem.count = amount;
                toItems.push(newItem);
            }
        }

        refreshInventory();

        // No move-in flash animation to avoid flicker.

        // Send to FiveM (keep immediate local update, server sync can reconcile).
        if (!CONFIG.isBrowser) {
            if (!Number.isFinite(fromSlot) || !Number.isFinite(toSlot)) return;
            var fromType = fromInv === 'player' ? 'player' : secondaryType;
            var toType = toInv === 'player' ? 'player' : secondaryType;
            fetchNUI('swapItems', {
                fromSlot: fromSlot,
                toSlot: toSlot,
                fromType: fromType,
                toType: toType,
                count: amount
            });
        }

        showToast('Item moved', 'success');
    }

    // ========== NUI FETCH HELPER ==========
    function fetchNUI(event, data) {
        return fetch('https://ox_inventory/' + event, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data || {})
        }).catch(function () {});
    }

    function fetchNUIJson(event, data) {
        return fetch('https://ox_inventory/' + event, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data || {})
        }).then(function (response) {
            return response.json().catch(function () { return null; });
        }).catch(function () {
            return null;
        });
    }

    // ========== ACTIONS ==========
    function getItemBySlot(slot, inventory) {
        if (!slot || !inventory) return null;
        var items = inventory === 'player' ? state.playerInventory : state.secondaryInventory;
        for (var i = 0; i < items.length; i++) {
            if (items[i].slot === slot) return items[i];
        }
        return null;
    }

    function getSelectedItem() {
        return getItemBySlot(state.selectedSlot, state.selectedInventory);
    }

    function getActionAmount(maxCount) {
        var raw = parseInt(actionAmount.value, 10);
        if (!Number.isFinite(raw) || raw <= 0) return maxCount;
        return raw > maxCount ? maxCount : raw;
    }

    function useItem() {
        var item = getSelectedItem();
        if (!item) { showToast('No item selected', 'error'); return; }

        showToast('Using ' + item.label, 'info');

        if (!CONFIG.isBrowser) {
            fetchNUI('useItem', state.selectedSlot);
            closeInventory();
        }
    }

    function setGiveButtonDropState(isActive) {
        btnGive.classList.toggle('action-btn-drop-target', !!isActive);
    }

    function closeGiveModal() {
        setGiveButtonDropState(false);
        state.giveModalOpen = false;
        state.giveLoading = false;
        state.giveSubmitting = false;
        state.giveTargets = [];
        state.giveSelection = 0;
        state.pendingGive = null;
        giveModal.classList.add('hidden');
        giveTargetList.innerHTML = '';
        giveModalSubtitle.textContent = 'Detecting nearby IDs...';
        giveItemName.textContent = 'No item selected';
        giveItemCount.textContent = 'x0';
    }

    function renderGiveTargets() {
        giveTargetList.innerHTML = '';

        if (state.giveLoading) {
            var loading = document.createElement('div');
            loading.className = 'give-target-empty';
            loading.textContent = 'Scanning nearby IDs...';
            giveTargetList.appendChild(loading);
            return;
        }

        if (!state.giveTargets.length) {
            var empty = document.createElement('div');
            empty.className = 'give-target-empty';
            empty.textContent = 'No nearby IDs available.';
            giveTargetList.appendChild(empty);
            return;
        }

        for (var i = 0; i < state.giveTargets.length; i++) {
            var target = state.giveTargets[i];
            var button = document.createElement('button');
            button.className = 'give-target' + (i === state.giveSelection ? ' is-selected' : '');
            button.type = 'button';
            button.dataset.index = i;

            var meters = Math.max(1, Math.round(Number(target.distance) || 0));
            button.innerHTML =
                '<span class="give-target-main">' +
                    '<span class="give-target-label">' + target.label + '</span>' +
                    '<span class="give-target-meta">ID available</span>' +
                '</span>' +
                '<span class="give-target-distance">' + meters + 'm</span>';

            button.addEventListener('click', function () {
                var index = parseInt(this.dataset.index, 10);
                if (!Number.isFinite(index)) return;
                state.giveSelection = index;
                renderGiveTargets();
                confirmGiveSelection();
            });

            giveTargetList.appendChild(button);
        }
    }

    function setGiveSelection(index) {
        if (!state.giveTargets.length) return;
        if (index < 0) index = state.giveTargets.length - 1;
        if (index >= state.giveTargets.length) index = 0;
        state.giveSelection = index;
        renderGiveTargets();
    }

    function openGiveModalForItem(item, slot, inventory, count) {
        if (!item) { showToast('No item selected', 'error'); return; }
        if (inventory !== 'player') { showToast('Only player inventory items can be given', 'error'); return; }

        var giveCount = Number.isFinite(count) ? count : getActionAmount(item.count);
        if (!Number.isFinite(giveCount) || giveCount < 1) giveCount = item.count;
        if (giveCount > item.count) giveCount = item.count;

        state.pendingGive = {
            slot: slot,
            inventory: inventory,
            count: giveCount,
            itemLabel: item.label
        };
        state.giveModalOpen = true;
        state.giveLoading = true;
        state.giveSubmitting = false;
        state.giveTargets = [];
        state.giveSelection = 0;
        state.giveRequestId += 1;

        giveItemName.textContent = item.label;
        giveItemCount.textContent = 'x' + giveCount;
        giveModalSubtitle.textContent = 'Detecting nearby IDs...';
        renderGiveTargets();
        giveModal.classList.remove('hidden');

        if (CONFIG.isBrowser) {
            state.giveLoading = false;
            state.giveTargets = DEMO_GIVE_TARGETS.slice();
            giveModalSubtitle.textContent = state.giveTargets.length + ' nearby IDs detected';
            renderGiveTargets();
            return;
        }

        var requestId = state.giveRequestId;
        fetchNUIJson('getGiveTargets', {}).then(function (response) {
            if (!state.giveModalOpen || requestId !== state.giveRequestId) return;

            state.giveLoading = false;
            state.giveTargets = response && response.targets ? response.targets : [];
            state.giveSelection = 0;

            if (!response || response.success === false) {
                showToast((response && response.message) || 'Unable to detect nearby IDs', 'error');
                closeGiveModal();
                return;
            }

            if (!state.giveTargets.length) {
                showToast('No nearby IDs detected', 'error');
                closeGiveModal();
                return;
            }

            giveModalSubtitle.textContent = state.giveTargets.length + ' nearby IDs detected';
            renderGiveTargets();
        });
    }

    function confirmGiveSelection() {
        if (!state.giveModalOpen || state.giveLoading || state.giveSubmitting) return;
        if (!state.pendingGive || !state.giveTargets.length) return;

        var target = state.giveTargets[state.giveSelection];
        if (!target) return;
        var pendingGive = {
            slot: state.pendingGive.slot,
            count: state.pendingGive.count,
            itemLabel: state.pendingGive.itemLabel
        };
        var targetLabel = target.label;

        state.giveSubmitting = true;
        giveModalSubtitle.textContent = 'Giving to ' + targetLabel + '...';

        if (CONFIG.isBrowser) {
            state.giveSubmitting = false;
            showToast('Gave ' + pendingGive.count + 'x ' + pendingGive.itemLabel + ' to ' + targetLabel, 'success');
            closeGiveModal();
            return;
        }

        fetchNUIJson('giveItemToTargetId', {
            slot: pendingGive.slot,
            count: pendingGive.count,
            targetId: target.id
        }).then(function (response) {
            state.giveSubmitting = false;

            if (response && response.success) {
                showToast('Gave ' + pendingGive.count + 'x ' + pendingGive.itemLabel + ' to ' + targetLabel, 'success');
                closeGiveModal();
                return;
            }

            if (!state.giveModalOpen) return;
            giveModalSubtitle.textContent = (response && response.message) || 'Target no longer available';
        });
    }

    function giveItem() {
        var item = getSelectedItem();
        if (!item) { showToast('No item selected', 'error'); return; }
        openGiveModalForItem(item, state.selectedSlot, state.selectedInventory, getActionAmount(item.count));
    }

    function dropItem() {
        var item = getSelectedItem();
        if (!item) { showToast('No item selected', 'error'); return; }
        var selectedSlot = state.selectedSlot;
        var selectedInventory = state.selectedInventory;
        if (!selectedSlot) { showToast('Invalid slot', 'error'); return; }

        var amount = getActionAmount(item.count);
        if (!Number.isFinite(amount) || amount < 1) amount = 1;

        // Fast local update for instant feedback; server sync will reconcile.
        var items = selectedInventory === 'player' ? state.playerInventory : state.secondaryInventory;
        var idx = items.indexOf(item);
        if (idx !== -1) {
            if (amount >= item.count) items.splice(idx, 1);
            else item.count -= amount;
            refreshInventory();
        }

        clearSelection();

        if (!CONFIG.isBrowser) {
            var secondaryType = state.secondaryType || 'other';
            if (secondaryType === 'drop') secondaryType = 'newdrop';
            fetchNUI('swapItems', {
                fromSlot: selectedSlot,
                toSlot: selectedSlot,
                fromType: selectedInventory === 'player' ? 'player' : secondaryType,
                toType: 'newdrop',
                count: amount
            });
            showToast('Dropped ' + amount + 'x ' + item.label, 'info');
        } else {
            showToast('Dropped ' + amount + 'x ' + item.label, 'error');
        }
    }

    function clearSelection() {
        var sel = document.querySelectorAll('.slot-selected');
        for (var i = 0; i < sel.length; i++) sel[i].classList.remove('slot-selected');
        state.selectedSlot = null;
        state.selectedInventory = null;
    }

    // ========== SEARCH (debounced) ==========
    var searchTimers = { player: null, secondary: null };
    var searchHideDuration = 260;
    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }
    function buildSearchableText(item) {
        if (!item) return '';
        var metaText = '';
        if (item.metadata) {
            try {
                metaText = JSON.stringify(item.metadata);
            } catch (e) {
                metaText = '';
            }
        }

        return normalizeText([
            item.label,
            item.name,
            item.description,
            item.type,
            item.metadata && item.metadata.label,
            metaText
        ].join(' '));
    }
    function slotMatchesQuery(item, q) {
        if (!item || !q) return false;
        return buildSearchableText(item).indexOf(q) !== -1;
    }
    function captureVisibleSlotRects(containerEl) {
        var rects = new Map();
        var slots = containerEl.querySelectorAll('.inv-slot');
        for (var i = 0; i < slots.length; i++) {
            var slot = slots[i];
            if (slot.classList.contains('slot-search-hidden')) continue;
            rects.set(slot, slot.getBoundingClientRect());
        }
        return rects;
    }
    function animateSlotReflow(containerEl, beforeRects) {
        if (!beforeRects || beforeRects.size === 0) return;
        requestAnimationFrame(function () {
            var slots = containerEl.querySelectorAll('.inv-slot');
            for (var i = 0; i < slots.length; i++) {
                var slot = slots[i];
                if (slot.classList.contains('slot-search-hidden')) continue;

                var before = beforeRects.get(slot);
                if (!before) continue;
                var after = slot.getBoundingClientRect();
                var dx = before.left - after.left;
                var dy = before.top - after.top;

                if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;

                if (slot._reflowAnim) {
                    slot._reflowAnim.cancel();
                    slot._reflowAnim = null;
                }

                if (slot.animate) {
                    slot._reflowAnim = slot.animate(
                        [
                            { transform: 'translate3d(' + dx + 'px, ' + dy + 'px, 0)' },
                            { transform: 'translate3d(0, 0, 0)' }
                        ],
                        {
                            duration: 260,
                            easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
                        }
                    );
                    slot._reflowAnim.onfinish = function () {
                        this._reflowAnim = null;
                    }.bind(slot);
                    slot._reflowAnim.oncancel = function () {
                        this._reflowAnim = null;
                    }.bind(slot);
                }
            }
        });
    }
    function setSlotSearchVisibility(slot, isVisible, containerEl) {
        if (isVisible) {
            var wasHidden = slot.classList.contains('slot-search-hidden');

            if (slot._searchHideTimer) {
                clearTimeout(slot._searchHideTimer);
                slot._searchHideTimer = null;
            }

            if (slot.classList.contains('slot-search-hidden')) {
                slot.classList.remove('slot-search-hidden');
                void slot.offsetWidth;
            }

            slot.classList.remove('slot-search-out');
            if (wasHidden) {
                var baseOrder = parseInt(slot.style.order || slot.dataset.slot || '0', 10) || 0;
                slot.style.animationDelay = ((baseOrder % 8) * 0.012) + 's';
                slot.classList.remove('slot-search-in');
                void slot.offsetWidth;
                slot.classList.add('slot-search-in');

                if (slot._searchInTimer) {
                    clearTimeout(slot._searchInTimer);
                }
                slot._searchInTimer = setTimeout(function () {
                    slot.classList.remove('slot-search-in');
                    slot.style.animationDelay = '';
                    slot._searchInTimer = null;
                }, 280);
            }

            slot.style.pointerEvents = '';
            return;
        }

        if (slot.classList.contains('slot-search-hidden')) {
            return;
        }

        if (slot.classList.contains('slot-search-out')) {
            if (!slot._searchHideTimer) {
                slot.classList.add('slot-search-hidden');
            }
            return;
        }

        if (slot._searchInTimer) {
            clearTimeout(slot._searchInTimer);
            slot._searchInTimer = null;
        }
        slot.classList.remove('slot-search-in');
        slot.style.animationDelay = '';

        slot.classList.add('slot-search-out');
        slot.style.pointerEvents = 'none';
        slot._searchHideTimer = setTimeout(function () {
            var beforeRects = captureVisibleSlotRects(containerEl);
            slot.classList.add('slot-search-hidden');
            slot.classList.remove('slot-search-out');
            slot._searchHideTimer = null;
            animateSlotReflow(containerEl, beforeRects);
        }, searchHideDuration);
    }
    function filterSlots(containerEl, query, inventoryType) {
        var key = inventoryType === 'secondary' ? 'secondary' : 'player';
        clearTimeout(searchTimers[key]);
        searchTimers[key] = setTimeout(function () {
            var slots = containerEl.querySelectorAll('.inv-slot');
            var q = normalizeText(query).trim();
            var visibleOrder = 0;
            var beforeRects = captureVisibleSlotRects(containerEl);
            for (var i = 0; i < slots.length; i++) {
                var slot = slots[i];
                if (!q) {
                    slot.style.order = '';
                    setSlotSearchVisibility(slot, true, containerEl);
                    continue;
                }

                if (slot.dataset.item) {
                    var item = null;
                    try {
                        item = JSON.parse(slot.dataset.item);
                    } catch (e) {
                        item = null;
                    }
                    var match = slotMatchesQuery(item, q);
                    if (match) {
                        slot.style.order = String(visibleOrder++);
                    } else {
                        slot.style.order = '';
                    }
                    setSlotSearchVisibility(slot, match, containerEl);
                } else {
                    slot.style.order = '';
                    setSlotSearchVisibility(slot, false, containerEl);
                }
            }
            animateSlotReflow(containerEl, beforeRects);
        }, 80);
    }

    // ========== REFRESH ==========
    function refreshInventory() {
        updateSlots(playerSlotsEl, state.playerInventory, 'player');
        updateSlots(secondarySlotsEl, state.secondaryInventory, 'secondary');
        updateWeight('player');
        updateWeight('secondary');
        filterSlots(playerSlotsEl, state.searchPlayer, 'player');
        filterSlots(secondarySlotsEl, state.searchSecondary, 'secondary');
    }

    // ========== OPEN / CLOSE ==========
    function openInventory(data) {
        if (state.isOpen) return;
        state.isOpen = true;

        if (data) {
            if (data.playerName) playerNameEl.textContent = data.playerName;
            if (data.playerId) playerIdEl.textContent = 'ID: ' + data.playerId;
            if (data.secondaryName) secondaryNameEl.textContent = data.secondaryName;
            if (data.secondaryId) secondaryIdEl.textContent = data.secondaryId;
            if (data.secondaryType) state.secondaryType = data.secondaryType;
            else if (data.secondaryId === 'newdrop' || data.secondaryId === 'drop') state.secondaryType = data.secondaryId;
            else if (data.secondaryId) state.secondaryType = 'other';
            if (data.maxWeight) CONFIG.maxWeight = data.maxWeight;
            if (data.secondaryMaxWeight) CONFIG.secondaryMaxWeight = data.secondaryMaxWeight;
            if (data.playerSlots) CONFIG.playerSlots = data.playerSlots;
            if (data.secondarySlots) CONFIG.secondarySlots = data.secondarySlots;
            if (data.playerInventory) state.playerInventory = toArray(data.playerInventory);
            if (data.secondaryInventory) state.secondaryInventory = toArray(data.secondaryInventory);
        }

        // Always open with clean search state.
        clearTimeout(searchTimers.player);
        clearTimeout(searchTimers.secondary);
        state.searchPlayer = '';
        state.searchSecondary = '';
        playerSearch.value = '';
        secondarySearch.value = '';
        actionAmount.value = '0';

        generateSlots(playerSlotsEl, CONFIG.playerSlots, 'player');
        generateSlots(secondarySlotsEl, CONFIG.secondarySlots, 'secondary');
        refreshInventory();
        createParticles();

        container.classList.remove('hidden', 'closing');
    }

    function closeInventory() {
        if (!state.isOpen) return;
        state.isOpen = false;

        closeGiveModal();
        hideTooltip();
        hideContextMenu();
        clearSelection();

        if (state.isDragging) {
            state.isDragging = false;
            if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
            dragGhost.classList.add('hidden');
        }

        // Ensure the next open starts unfiltered.
        clearTimeout(searchTimers.player);
        clearTimeout(searchTimers.secondary);
        state.searchPlayer = '';
        state.searchSecondary = '';
        playerSearch.value = '';
        secondarySearch.value = '';
        filterSlots(playerSlotsEl, '', 'player');
        filterSlots(secondarySlotsEl, '', 'secondary');

        container.classList.add('closing');
        setTimeout(function () {
            container.classList.add('hidden');
            container.classList.remove('closing');
        }, 300);

        if (!CONFIG.isBrowser) {
            fetchNUI('exit');
        }
    }

    // ========== EVENT LISTENERS ==========
    closeBtn.addEventListener('click', closeInventory);

    document.addEventListener('keydown', function (e) {
        if (state.giveModalOpen) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeGiveModal();
                return;
            }

            if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
                e.preventDefault();
                setGiveSelection(state.giveSelection - 1);
                return;
            }

            if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
                e.preventDefault();
                setGiveSelection(state.giveSelection + 1);
                return;
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                confirmGiveSelection();
                return;
            }

            return;
        }

        if (e.key === 'Escape') {
            if (!contextMenu.classList.contains('hidden')) {
                hideContextMenu();
            } else if (state.isOpen) {
                closeInventory();
            }
        }
        // Hotbar keys 1-5
        if (state.isOpen && e.key >= '1' && e.key <= '5') {
            var slotNum = parseInt(e.key);
            var item = null;
            for (var i = 0; i < state.playerInventory.length; i++) {
                if (state.playerInventory[i].slot === slotNum) { item = state.playerInventory[i]; break; }
            }
            if (item) {
                clearSelection();
                var slotEl = playerSlotsEl.querySelector('.inv-slot[data-slot="' + slotNum + '"]');
                if (slotEl) {
                    slotEl.classList.add('slot-selected');
                    state.selectedSlot = slotNum;
                    state.selectedInventory = 'player';
                    showToast(item.label + ' selected', 'info');
                }
            }
        }
    });

    document.addEventListener('mousemove', function (e) {
        state.mouseX = e.clientX;
        state.mouseY = e.clientY;
        if (!tooltipEl.classList.contains('hidden') && !state.isDragging) {
            positionTooltip(e.clientX, e.clientY);
        }
    });

    document.addEventListener('click', function (e) {
        if (!contextMenu.classList.contains('hidden') && !contextMenu.contains(e.target)) {
            hideContextMenu();
        }

        if (state.giveModalOpen && !giveModal.contains(e.target) && !btnGive.contains(e.target)) {
            closeGiveModal();
        }
    });

    // Action Buttons
    btnUse.addEventListener('click', useItem);
    btnGive.addEventListener('click', giveItem);
    btnDrop.addEventListener('click', dropItem);
    btnInfo.addEventListener('click', function () {
        var item = getSelectedItem();
        if (!item) { showToast('Select an item first', 'info'); return; }

        var infoMsg = item.label;
        if (item.metadata && item.metadata.serial) infoMsg += ' | S/N: ' + item.metadata.serial;
        if (item.durability !== null && item.durability !== undefined) infoMsg += ' | Durability: ' + item.durability + '%';
        showToast(infoMsg, 'info');
    });

    // Context Menu Actions
    var ctxItems = contextMenu.querySelectorAll('.context-item');
    for (var ci = 0; ci < ctxItems.length; ci++) {
        ctxItems[ci].addEventListener('click', function () {
            var action = this.dataset.action;
            hideContextMenu();
            if (action === 'use') useItem();
            else if (action === 'give') giveItem();
            else if (action === 'drop') dropItem();
        });
    }

    // Search
    playerSearch.addEventListener('input', function () {
        state.searchPlayer = this.value || '';
        filterSlots(playerSlotsEl, state.searchPlayer, 'player');
    });
    secondarySearch.addEventListener('input', function () {
        state.searchSecondary = this.value || '';
        filterSlots(secondarySlotsEl, state.searchSecondary, 'secondary');
    });

    // ========== FIVEM NUI MESSAGE HANDLER ==========
    window.addEventListener('message', function (event) {
        var data = event.data;
        if (!data || !data.action) return;

        switch (data.action) {
            case 'open':
                openInventory(data);
                break;

            case 'setupInventory': {
                var invData = data.data || {};
                var left = invData.leftInventory || {};
                var right = invData.rightInventory || {};

                openInventory({
                    playerName: left.label || 'Player Inventory',
                    playerId: left.id || '',
                    secondaryName: right.label || right.name || 'Secondary',
                    secondaryId: right.type || right.id || '',
                    secondaryType: right.type || 'other',
                    maxWeight: left.maxWeight || CONFIG.maxWeight,
                    secondaryMaxWeight: right.maxWeight || CONFIG.secondaryMaxWeight,
                    playerSlots: left.slots || CONFIG.playerSlots,
                    secondarySlots: right.slots || CONFIG.secondarySlots,
                    playerInventory: toArray(left.items),
                    secondaryInventory: toArray(right.items)
                });
                break;
            }

            case 'close':
            case 'closeInventory':
                closeInventory();
                break;

            case 'update':
                if (data.playerInventory) state.playerInventory = toArray(data.playerInventory);
                if (data.secondaryInventory) state.secondaryInventory = toArray(data.secondaryInventory);
                refreshInventory();
                break;

            case 'refreshSlots': {
                var payload = data.data || {};
                var changes = payload.items || [];
                for (var i = 0; i < changes.length; i++) {
                    var change = changes[i];
                    if (!change || !change.item) continue;
                    var list = change.inventory === 'player' ? state.playerInventory : state.secondaryInventory;
                    upsertItem(list, change.item);
                }
                refreshInventory();
                break;
            }

            case 'notify':
            case 'showNotification':
                showToast(data.message || data.text, data.type || 'info');
                break;

            case 'updateSlots':
                if (data.items) {
                    var inv = data.inventory === 'player' ? 'playerInventory' : 'secondaryInventory';
                    state[inv] = toArray(data.items);
                    refreshInventory();
                }
                break;

            case 'updateWeight':
                if (data.inventory === 'player') {
                    if (data.maxWeight) CONFIG.maxWeight = data.maxWeight;
                } else {
                    if (data.maxWeight) CONFIG.secondaryMaxWeight = data.maxWeight;
                }
                updateWeight(data.inventory || 'player');
                break;

            case 'setSecondaryTitle':
                if (data.name) secondaryNameEl.textContent = data.name;
                if (data.id) secondaryIdEl.textContent = data.id;
                break;

            case 'init': {
                var initData = data.data || {};
                if (initData.imagepath) CONFIG.imagePath = initData.imagepath;
                if (initData.leftInventory) {
                    CONFIG.playerSlots = initData.leftInventory.slots || CONFIG.playerSlots;
                    CONFIG.maxWeight = initData.leftInventory.maxWeight || CONFIG.maxWeight;
                    state.playerInventory = toArray(initData.leftInventory.items);
                }
                break;
            }
        }
    });

    if (!CONFIG.isBrowser) {
        fetchNUI('uiLoaded', {});
    }

    // ========== INIT (Browser demo) ==========
    if (CONFIG.isBrowser) {
        state.playerInventory = DEMO_ITEMS.slice();
        state.secondaryInventory = DEMO_SECONDARY.slice();
        openInventory({
            playerName: 'John Doe',
            playerId: '42',
            secondaryName: 'Trunk',
            secondaryId: 'Vehicle',
            maxWeight: 120,
            secondaryMaxWeight: 80
        });
    }
})();
