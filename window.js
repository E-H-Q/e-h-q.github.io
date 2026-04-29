// WINDOW.JS: SIMPLE WINDOW SYSTEM FOR CANVAS UI

var activeWindow = null;
var activeContextMenu = null;

var WindowSystem = {
    getItemLabel: function(index) {
        if (index < 26) return String.fromCharCode(97 + index);
        else if (index < 52) return String.fromCharCode(65 + (index - 26));
        else if (index < 62) return String.fromCharCode(48 + (index - 52));
        return "?";
    },

    getIndexFromKey: function(key) {
        if (!key || key.length !== 1) return -1;
        const code = key.charCodeAt(0);
        if (code >= 97 && code <= 122) return code - 97;
        if (code >= 65 && code <= 90) return 26 + (code - 65);
        if (code >= 48 && code <= 57) return 52 + (code - 48);
        return -1;
    },

    openSelectionWindow: function(config) {
        const win = {
            title: config.title || "Select",
            x: 0, y: 0,
            width: config.width || 400,
            height: config.height || 300,
            items: config.items || [],
            selectedIndices: config.preSelectedIndices
                ? new Set(config.preSelectedIndices)
                : new Set(),
            hoveredIndex: 0,
            onConfirm: config.onConfirm || null,
            onCancel: config.onCancel || null,
            scrollOffset: 0,
            itemHeight: 30,
            headerHeight: 0,
            footerHeight: 40,
            padding: 10,
            isExamineWindow: false,
            entity: null,
            confirmLabel: config.confirmLabel || "OK",
            multiSelect: config.multiSelect !== false
        };
        win.x = (c.width - win.width) / 2;
        win.y = (c.height - win.height) / 2;
        this.open(win);
    },

    create: function(config) {
        const window = {
            title: config.title || "Window",
            x: config.x || 100,
            y: config.y || 100,
            width: config.width || 300,
            height: config.height || 200,
            items: config.items || [],
            selectedIndices: new Set(),
            hoveredIndex: 0,
            onConfirm: config.onConfirm || null,
            onCancel: config.onCancel || null,
            scrollOffset: 0,
            itemHeight: 30,
            headerHeight: 0,
            footerHeight: 40,
            padding: 10,
            isExamineWindow: config.isExamineWindow || false,
            entity: config.entity || null,
            confirmLabel: "Take Items",
            multiSelect: true
        };
        window.x = (c.width - window.width) / 2;
        window.y = (c.height - window.height) / 2;
        return window;
    },

    open: function(window) {
        activeWindow = window;
        update();
    },

    close: function() {
        activeWindow = null;
        isAiming = false;
        update();
    },

    draw: function() {
        if (!activeWindow) {
            if (activeContextMenu) this.drawContextMenu();
            return;
        }

        const win = activeWindow;

        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, c.width, c.height);

        ctx.fillStyle = "#000000";
        ctx.fillRect(win.x, win.y, win.width, win.height);

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.strokeRect(win.x, win.y, win.width, win.height);

        if (win.isExamineWindow) {
            this.drawExamineWindow(win);
        } else {
            this.drawSelectionWindow(win);
        }

        if (activeContextMenu) this.drawContextMenu();
    },

    drawSelectionWindow: function(win) {
        const contentY = win.y + win.headerHeight;
        const contentHeight = win.height - win.headerHeight - win.footerHeight;
        const maxVisibleItems = Math.floor((contentHeight - win.padding * 2) / win.itemHeight);

        ctx.textAlign = "left";
        ctx.font = "14px monospace";

        const startIndex = Math.floor(win.scrollOffset);
        const endIndex = Math.min(win.items.length, startIndex + maxVisibleItems);

        for (let i = startIndex; i < endIndex; i++) {
            const item = win.items[i];
            const itemY = contentY + win.padding + (i - startIndex) * win.itemHeight;

            let bgColor = "#000000";
            if (win.selectedIndices.has(i)) bgColor = "#004400";
            else if (i === win.hoveredIndex) bgColor = "#333333";

            ctx.fillStyle = bgColor;
            ctx.fillRect(win.x + win.padding, itemY, win.width - win.padding * 2, win.itemHeight);

            ctx.strokeStyle = win.selectedIndices.has(i) ? "#00ff00" : "#666666";
            ctx.lineWidth = 1;
            ctx.strokeRect(win.x + win.padding, itemY, win.width - win.padding * 2, win.itemHeight);

            const checkboxX = win.x + win.padding + 5;
            const checkboxY = itemY + 7;
            const checkboxSize = 16;

            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.strokeRect(checkboxX, checkboxY, checkboxSize, checkboxSize);

            if (win.selectedIndices.has(i)) {
                ctx.fillStyle = "#00ff00";
                ctx.fillRect(checkboxX + 3, checkboxY + 3, checkboxSize - 6, checkboxSize - 6);
            }

            const label = this.getItemLabel(i);
            ctx.fillStyle = "#ffffff";
            ctx.font = "14px monospace";
            ctx.fillText("(" + label + ") " + item.text, checkboxX + checkboxSize + 10, itemY + 20);
        }

        if (win.items.length > maxVisibleItems) {
            const scrollbarX = win.x + win.width - 15;
            const scrollbarHeight = contentHeight - 10;
            const scrollbarY = contentY + 5;

            ctx.fillStyle = "#333333";
            ctx.fillRect(scrollbarX, scrollbarY, 10, scrollbarHeight);

            const thumbHeight = Math.max(20, (maxVisibleItems / win.items.length) * scrollbarHeight);
            const thumbY = scrollbarY + (win.scrollOffset / win.items.length) * scrollbarHeight;
            ctx.fillStyle = "#666666";
            ctx.fillRect(scrollbarX, thumbY, 10, thumbHeight);
        }

        const footerY = win.y + win.height - win.footerHeight;
        const buttonWidth = 100;
        const buttonHeight = 25;
        const buttonY = footerY + 8;
        const confirmX = win.x + win.width - buttonWidth - 110;
        const cancelX = win.x + win.width - buttonWidth - 10;

        ctx.fillStyle = win.selectedIndices.size > 0 ? "#00aa00" : "#333333";
        ctx.fillRect(confirmX, buttonY, buttonWidth, buttonHeight);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.strokeRect(confirmX, buttonY, buttonWidth, buttonHeight);
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(win.confirmLabel || "OK", confirmX + buttonWidth / 2, buttonY + 17);

        ctx.fillStyle = "#aa0000";
        ctx.fillRect(cancelX, buttonY, buttonWidth, buttonHeight);
        ctx.strokeStyle = "#ffffff";
        ctx.strokeRect(cancelX, buttonY, buttonWidth, buttonHeight);
        ctx.fillStyle = "#ffffff";
        ctx.fillText("Cancel", cancelX + buttonWidth / 2, buttonY + 17);
    },

    handleClick: function(mouseX, mouseY) {
        if (activeContextMenu) return this.handleContextMenuClick(mouseX, mouseY);
        if (!activeWindow) return false;

        const win = activeWindow;

        if (win.isExamineWindow) {
            if (mouseX < win.x || mouseX > win.x + win.width ||
                mouseY < win.y || mouseY > win.y + win.height) {
                this.close();
                return true;
            }
            return true;
        }

        const footerY = win.y + win.height - win.footerHeight;
        const buttonWidth = 100;
        const buttonHeight = 25;
        const buttonY = footerY + 8;
        const confirmX = win.x + win.width - buttonWidth - 110;
        const cancelX = win.x + win.width - buttonWidth - 10;

        if (mouseX >= confirmX && mouseX <= confirmX + buttonWidth &&
            mouseY >= buttonY && mouseY <= buttonY + buttonHeight &&
            win.selectedIndices.size > 0) {
            this.confirm();
            return true;
        }

        if (mouseX >= cancelX && mouseX <= cancelX + buttonWidth &&
            mouseY >= buttonY && mouseY <= buttonY + buttonHeight) {
            this.cancel();
            return true;
        }

        if (mouseX < win.x || mouseX > win.x + win.width ||
            mouseY < win.y || mouseY > win.y + win.height) {
            this.cancel();
            return true;
        }

        const contentY = win.y + win.headerHeight;
        const contentHeight = win.height - win.headerHeight - win.footerHeight;
        const maxVisibleItems = Math.floor((contentHeight - win.padding * 2) / win.itemHeight);
        const startIndex = Math.floor(win.scrollOffset);

        for (let i = startIndex; i < Math.min(win.items.length, startIndex + maxVisibleItems); i++) {
            const itemY = contentY + win.padding + (i - startIndex) * win.itemHeight;

            if (mouseX >= win.x + win.padding &&
                mouseX <= win.x + win.width - win.padding &&
                mouseY >= itemY &&
                mouseY <= itemY + win.itemHeight) {

                if (win.selectedIndices.has(i)) {
                    win.selectedIndices.delete(i);
                } else {
                    win.selectedIndices.add(i);
                }
                update();
                return true;
            }
        }

        return true;
    },

    handleMouseMove: function(mouseX, mouseY) {
        if (activeContextMenu) return this.handleContextMenuMove(mouseX, mouseY);
        if (!activeWindow) return false;

        const win = activeWindow;
        const contentY = win.y + win.headerHeight;
        const contentHeight = win.height - win.headerHeight - win.footerHeight;
        const maxVisibleItems = Math.floor((contentHeight - win.padding * 2) / win.itemHeight);
        const startIndex = Math.floor(win.scrollOffset);

        win.hoveredIndex = -1;

        for (let i = startIndex; i < Math.min(win.items.length, startIndex + maxVisibleItems); i++) {
            const itemY = contentY + win.padding + (i - startIndex) * win.itemHeight;

            if (mouseX >= win.x + win.padding &&
                mouseX <= win.x + win.width - win.padding &&
                mouseY >= itemY &&
                mouseY <= itemY + win.itemHeight) {
                win.hoveredIndex = i;
                update();
                return true;
            }
        }

        update();
        return true;
    },

    handleKeyboard: function(event) {
        if (activeContextMenu) return this.handleContextMenuKeyboard(event);
        if (!activeWindow) return false;

        const win = activeWindow;

        if (win.isExamineWindow) {
            if (event.keyCode === 27 && event.type === 'keydown') {
                event.preventDefault();
                this.close();
                return true;
            }
            event.preventDefault();
            return true;
        }

        if (event.type === 'keydown' && event.key && event.key.length === 1) {
            const index = this.getIndexFromKey(event.key);
            if (index >= 0 && index < win.items.length) {
                event.preventDefault();
                if (win.selectedIndices.has(index)) {
                    win.selectedIndices.delete(index);
                } else {
                    win.selectedIndices.add(index);
                }
                win.hoveredIndex = index;
                update();
                return true;
            }
        }

        if (event.type !== 'keydown') return false;

        if (event.keyCode === 38) {
            event.preventDefault();
            if (win.hoveredIndex > 0) { win.hoveredIndex--; update(); }
            return true;
        }

        if (event.keyCode === 40) {
            event.preventDefault();
            if (win.hoveredIndex < win.items.length - 1) { win.hoveredIndex++; update(); }
            else if (win.hoveredIndex === -1 && win.items.length > 0) { win.hoveredIndex = 0; update(); }
            return true;
        }

        if (event.keyCode === 13) {
            event.preventDefault();
            this.confirm();
            return true;
        }

        if (event.keyCode === 27) {
            event.preventDefault();
            this.cancel();
            return true;
        }

        if (event.keyCode === 32) {
            event.preventDefault();
            if (win.hoveredIndex >= 0) {
                if (win.selectedIndices.has(win.hoveredIndex)) win.selectedIndices.delete(win.hoveredIndex);
                else win.selectedIndices.add(win.hoveredIndex);
                update();
            }
            return true;
        }

        event.preventDefault();
        return true;
    },

    confirm: function() {
        if (!activeWindow) return;
        const win = activeWindow;
        if (win.onConfirm && win.selectedIndices.size > 0) {
            const selectedItems = Array.from(win.selectedIndices).map(i => win.items[i]);
            win.onConfirm(selectedItems, win.selectedIndices);
        }
        this.close();
    },

    cancel: function() {
        if (!activeWindow) return;
        const win = activeWindow;
        if (win.onCancel) win.onCancel();
        this.close();
    },

    isOpen: function() {
        return activeWindow !== null;
    },

    openTraitsWindow: function(entity) {
        const traitKeys = Object.keys(entityTraits);
        const items = traitKeys.map(key => ({ text: entityTraits[key].name + ": " + entityTraits[key].description, key }));
        const preSelected = traitKeys
            .map((key, i) => (entity.traits && entity.traits.includes(key)) ? i : -1)
            .filter(i => i >= 0);

        this.openSelectionWindow({
            title: "Edit Traits: " + entity.name,
            width: 500,
            height: Math.min(600, 100 + items.length * 35),
            items,
            preSelectedIndices: preSelected,
            confirmLabel: "OK",
            onConfirm: function(selectedItems, selectedIndices) {
                const newTraits = Array.from(selectedIndices).map(i => traitKeys[i]);
                entity.traits = newTraits;
                console.log(entity.name + " traits updated: " + (newTraits.join(", ") || "none"));
                update();
            }
        });
    },

    createContextMenu: function(config) {
        return {
            x: config.x || 0,
            y: config.y || 0,
            tileX: config.tileX,
            tileY: config.tileY,
            options: config.options || [],
            hoveredIndex: -1,
            itemHeight: 25,
            padding: 1,
            width: 190
        };
    },

    openContextMenu: function(menu) {
        activeContextMenu = menu;
        update();
    },

    closeContextMenu: function() {
        activeContextMenu = null;
        update();
    },

    drawContextMenu: function() {
        if (!activeContextMenu) return;

        const menu = activeContextMenu;
        const height = menu.options.length * menu.itemHeight + menu.padding * 2;

        ctx.fillStyle = "#000000";
        ctx.fillRect(menu.x, menu.y, menu.width, height);

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.strokeRect(menu.x, menu.y, menu.width, height);

        ctx.font = "14px monospace";
        ctx.textAlign = "left";

        let isFirst = true;
        for (let i = 0; i < menu.options.length; i++) {
            const option = menu.options[i];
            const itemY = menu.y + menu.padding + i * menu.itemHeight;
            if (isFirst) {
                ctx.fillStyle = "#ffdf00";
                ctx.textAlign = "center";
                ctx.fillText(option.text, menu.x + menu.padding + menu.width / 2, itemY + 17);
                isFirst = false;
                ctx.textAlign = "left";
            } else {
                if (i === menu.hoveredIndex) {
                    ctx.fillStyle = "#333333";
                    ctx.fillRect(menu.x + menu.padding, itemY, menu.width - menu.padding * 2, menu.itemHeight);
                }
                ctx.fillStyle = option.danger ? "#ff4444" : "#ffffff";
                ctx.fillText(option.text, menu.x + menu.padding + 5, itemY + 17);
            }
        }
    },

    handleContextMenuMove: function(mouseX, mouseY) {
        if (!activeContextMenu) return false;

        const menu = activeContextMenu;
        const height = menu.options.length * menu.itemHeight + menu.padding * 2;

        const tileScreenX = (menu.tileX - camera.x) * tileSize;
        const tileScreenY = (menu.tileY - camera.y) * tileSize;

        const inMenu = mouseX >= menu.x && mouseX <= menu.x + menu.width &&
                       mouseY >= menu.y && mouseY <= menu.y + height;
        const inTile = mouseX >= tileScreenX && mouseX <= tileScreenX + tileSize &&
                       mouseY >= tileScreenY && mouseY <= tileScreenY + tileSize;

        if (!inMenu && !inTile) { this.closeContextMenu(); return true; }

        if (!inMenu) { menu.hoveredIndex = -1; update(); return true; }

        menu.hoveredIndex = -1;
        for (let i = 0; i < menu.options.length; i++) {
            const itemY = menu.y + menu.padding + i * menu.itemHeight;
            if (mouseY >= itemY && mouseY <= itemY + menu.itemHeight) {
                menu.hoveredIndex = i;
                update();
                break;
            }
        }

        return true;
    },

    handleContextMenuClick: function(mouseX, mouseY) {
        if (!activeContextMenu) return false;

        const menu = activeContextMenu;
        const height = menu.options.length * menu.itemHeight + menu.padding * 2;

        if (mouseX >= menu.x && mouseX <= menu.x + menu.width &&
            mouseY >= menu.y && mouseY <= menu.y + height) {
            for (let i = 0; i < menu.options.length; i++) {
                const itemY = menu.y + menu.padding + i * menu.itemHeight;
                if (mouseY >= itemY && mouseY <= itemY + menu.itemHeight) {
                    const option = menu.options[i];
                    this.closeContextMenu();
                    if (option.action) option.action();
                    return true;
                }
            }
        }

        this.closeContextMenu();
        return true;
    },

    handleContextMenuKeyboard: function(event) {
        if (!activeContextMenu) return false;

        const menu = activeContextMenu;
        const pressedKey = event.key ? event.key.toLowerCase() : null;

        if (pressedKey) {
            for (let option of menu.options) {
                if (option.key && option.key.toLowerCase() === pressedKey) {
                    event.preventDefault();
                    this.closeContextMenu();
                    if (option.action) option.action();
                    return true;
                }
            }
        }

        if (event.key && event.keyCode != 191 && event.keyCode != 32) {
            event.preventDefault();
            this.closeContextMenu();
            return true;
        }

        event.preventDefault();
        return true;
    },

    drawExamineWindow: function(win) {
        if (!win.entity) return;

        const entity = win.entity;
        const spriteSize = tileSize * 2;
        const LINE_HEIGHT = 20;
        const HEADER_HEIGHT = spriteSize + 80;
        const FOOTER_HEIGHT = 30;

        const traitsOnly = [];

        if (entity.traits) {
            const traitsOnly = entity.traits.slice(3);
        } else {
            const traitsOnly = [];
        }

        if (entity.type) {
            win.items = [];
            switch (entity.type) {
                case "wall":
                    win.items.push({ text: "A solid wall, blocks sight & attacks." });
                    win.items.push({ text: ""});
                    if (!entity.permanent) win.items.push({ text: "It can be destroyed by explosions." });
                    break;
                case "glass":
                    win.items.push({ text: "Clear glass, can be seen & attacked through." });
                    win.items.push({ text: ""});
                    if (!entity.permanent) win.items.push({ text: "Becomes damaged, then breaks." });
                    break;
                case "water":
                    win.items.push({ text: "Waist high water, difficult to move through." });
                    win.items.push({ text: ""});
                    win.items.push({ danger: true, text: "Movement range -50%" });
                    break;
                case "fire":
                    win.items.push({ text: "Blazing flames, walk carefully!" });
                     win.items.push({ text: ""});
                    win.items.push({ danger: true, text: 'Moving through fire inflicts "Fire" status effect.' });
                    win.items.push({ danger: true, text: "Entities on fire take " + fireDamage + "DMG at end of turn."});
                    if (!entity.permanent) {
                        win.items.push({ text: ""});
                        win.items.push({ text: "1 in 15 chance tile despawns at end of turn." });
                        win.items.push({ text: '1 in 3 chance to remove "Fire" status effect.' });
                    }
                    break;
                case "door":
                    win.items.push({ text: "A wooden door. It is " + (entity.open ? "open." : "closed.") });
                    win.items.push({ text: ""});
                    win.items.push({ text: "Right Click to open. Blocks sight when closed." });
                    if (!entity.permanent) win.items.push({ text: "Becomes damaged, then breaks."});
                    break;
            }
            if (entity.permanent) win.items.push({ danger: true, text: "It is permanent and cannot be destroyed." });
        } else if (entity.itemType) {
            win.items = [];
            const itemsAtLocation = mapItems.filter(item => item.x === entity.x && item.y === entity.y);
            const grouped = {};
            itemsAtLocation.forEach(item => {
                grouped[item.itemType] = (grouped[item.itemType] || 0) + 1;
            });
            for (const [itemType, count] of Object.entries(grouped)) {
                const itemDef = itemTypes[itemType];
                const label = count > 1 ? `${itemDef.displayName} (x${count})` : itemDef.displayName;
                win.items.push({ text: "- " + label });
            }
        } else if (helper.hasTrait(entity, "explode") && entity.turnsRemaining) {
            if (traitsOnly) {
                win.items = [... traitsOnly];
            }
            win.items.push({ text: "Detonation Countdown: " + entity.turnsRemaining});
            win.items.push({ text: " "});
            win.items.push({ text: "(" + entityTraits.explode.name + "): " + entityTraits.explode.description });
            win.items.push({ text: "(" + entityTraits.active.name + "): " + entityTraits.active.description });
        }

        win.height = Math.max(win.height, HEADER_HEIGHT + win.items.length * LINE_HEIGHT + FOOTER_HEIGHT);
        win.y = (c.height - win.height) / 2;

        ctx.fillStyle = "#000000";
        ctx.fillRect(win.x, win.y, win.width, win.height);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.strokeRect(win.x, win.y, win.width, win.height);

        const spriteY = win.y + 10;
        const spriteX = win.x + (win.width / 2) - (spriteSize / 2);

        if (entity.name) {
            const imgId = isPlayerControlled(entity) ? "pep" : "enemy";
            const img = document.getElementById(imgId);
            if (img && img.complete) ctx.drawImage(img, spriteX, spriteY, spriteSize, spriteSize);

            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 16px monospace";
            ctx.textAlign = "center";
            ctx.fillText(entity.name, spriteX + spriteSize / 2, spriteY + spriteSize + 20);
            ctx.font = "14px monospace";
            ctx.fillText("(X: " + entity.x + ", Y: " + entity.y + ")", spriteX + spriteSize / 2, spriteY + spriteSize + 35);

        } else if (entity.type) {
            const tilesImg = document.getElementById("tiles");
            if (tilesImg && tilesImg.complete) {
                const tileIndex = { wall: TILE_WALL, glass: TILE_GLASS, water: TILE_WATER, fire: TILE_FIRE, door: TILE_DOOR_CLOSED }[entity.type];
                if (tileIndex !== undefined) ctx.drawImage(tilesImg, tileIndex * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, spriteX, spriteY, spriteSize, spriteSize);
            }
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 16px monospace";
            ctx.textAlign = "center";
            ctx.fillText(entity.type, spriteX + spriteSize / 2, spriteY + spriteSize + 20);
            ctx.font = "14px monospace";
            ctx.fillText("(X: " + entity.x + ", Y: " + entity.y + ")", spriteX + spriteSize / 2, spriteY + spriteSize + 35);

        } else if (entity.itemType) {
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 16px monospace";
            ctx.textAlign = "center";
            ctx.fillText("Item(s)", spriteX + spriteSize / 2, spriteY + spriteSize + 20);
            ctx.font = "14px monospace";
            ctx.fillText("(X: " + entity.x + ", Y: " + entity.y + ")", spriteX + spriteSize / 2, spriteY + spriteSize + 35);
        }

        const contentY = win.y + HEADER_HEIGHT;
        ctx.fillStyle = "#ffffff";
        ctx.font = "14px monospace";
        ctx.textAlign = "left";
        for (let i = 0; i < win.items.length; i++) {
            if (win.items[i].danger) {
                ctx.fillStyle = "#ff4444";
            }
            ctx.fillText(win.items[i].text, win.x + win.padding + 10, contentY + (i * LINE_HEIGHT));
            ctx.fillStyle = "#ffffff";
        }

        ctx.fillStyle = "#888888";
        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Press ESC or click outside to close", win.x + win.width / 2, win.y + win.height - 12);
    },

    showExamineWindow: function(entity) {
        const stats = [];

        stats.push({ text: `HP: ${entity.hp}${entity.maxHp ? '/' + entity.maxHp : ''}` });
        stats.push({ text: `Movement: ${entity.range}` });
        stats.push({ text: `Attack Range: ${entity.attack_range}` });

        if (entity.damage) stats.push({ text: `Damage: +${entity.damage}` });
        if (entity.armor) stats.push({ text: `Armor: ${entity.armor}` });

        if (entity.equipment) {
            stats.push({ text: "" });
            stats.push({ text: "EQUIPMENT:" });

            if (entity.equipment.weapon) {
                const weaponDef = itemTypes[entity.equipment.weapon.itemType];
                const ammo = entity.equipment.weapon.currentAmmo;
                const maxAmmo = weaponDef.maxAmmo;
                let weaponText = `  Weapon: ${weaponDef.displayName}`;
                if (maxAmmo !== undefined) weaponText += ` [${ammo}/${maxAmmo}]`;
                stats.push({ text: weaponText });
            }

            if (entity.equipment.armor) {
                const armorDef = itemTypes[entity.equipment.armor.itemType];
                stats.push({ text: `  Armor: ${armorDef.displayName}` });
            }

            if (entity.equipment.accessory) {
                const accDef = itemTypes[entity.equipment.accessory.itemType];
                stats.push({ text: `  Accessory: ${accDef.displayName}` });
            }
        }

        if (entity.inventory && entity.inventory.length > 0) {
            stats.push({ text: "" });
            stats.push({ text: `INVENTORY (${entity.inventory.length} items):` });
            entity.inventory.forEach(item => {
                const itemDef = itemTypes[item.itemType];
                let itemText = `  - ${itemDef.displayName}`;
                if (item.quantity > 1) itemText += ` (x${item.quantity})`;
                if (item.currentAmmo !== undefined) itemText += ` [${item.currentAmmo}/${itemDef.maxAmmo}]`;
                stats.push({ text: itemText });
            });
        }

        if (entity.traits) {
            for (var i = 0; i < entity.traits.length; i++) {
                const traitDef = entityTraits[entity.traits[i]];
                if (traitDef) {
                    stats.push({ text: "(" + traitDef.name + "): " + traitDef.description });
                } else {
                    stats.push({ text: `Trait: ${entity.traits[i]}` });
                }
            }
        }

        const window = this.create({
            title: "examine",
            width: 450,
            height: Math.min(600, 200 + stats.length * 22),
            items: stats,
            selectedIndices: new Set(),
            isExamineWindow: true,
            entity: entity,
            onConfirm: null,
            onCancel: function() {}
        });
        this.open(window);
    }
};