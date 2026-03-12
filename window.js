// WINDOW.JS: SIMPLE WINDOW SYSTEM FOR CANVAS UI

var activeWindow = null;
var activeContextMenu = null;

var WindowSystem = {
    // Generate label for item at index (a-z, A-Z, 0-9)
    getItemLabel: function(index) {
        if (index < 26) {
            // a-z (0-25)
            return String.fromCharCode(97 + index);
        } else if (index < 52) {
            // A-Z (26-51)
            return String.fromCharCode(65 + (index - 26));
        } else if (index < 62) {
            // 0-9 (52-61)
            return String.fromCharCode(48 + (index - 52));
        }
        return "?";
    },
    
    // Get index from key character
    getIndexFromKey: function(key) {
        if (!key || key.length !== 1) return -1;
        const code = key.charCodeAt(0);
        
        // a-z (97-122)
        if (code >= 97 && code <= 122) {
            return code - 97;
        }
        // A-Z (65-90)
        if (code >= 65 && code <= 90) {
            return 26 + (code - 65);
        }
        // 0-9 (48-57)
        if (code >= 48 && code <= 57) {
            return 52 + (code - 48);
        }
        return -1;
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
            entity: config.entity || null
        };
        
        // Center window on canvas
        window.x = (c.width - window.width) / 2;
        window.y = (c.height - window.height) / 2;
        
        return window;
    },
    
    open: function(window) {
        activeWindow = window;
        update(); // Draw the game first, then window will draw on top
    },
    
    close: function() {
        activeWindow = null;
        update();
    },
    
    draw: function() {
        if (!activeWindow) {
            // Draw context menu even if no window is open
            if (activeContextMenu) {
                this.drawContextMenu();
            }
            return;
        }
        
        const win = activeWindow;
        
        // Draw semi-transparent overlay
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, c.width, c.height);
        
        // Draw window background (black)
        ctx.fillStyle = "#000000";
        ctx.fillRect(win.x, win.y, win.width, win.height);
        
        // Draw window border (2px white)
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.strokeRect(win.x, win.y, win.width, win.height);
        
        if (win.isExamineWindow) {
            // EXAMINE WINDOW - completely different rendering
            this.drawExamineWindow(win);
        } else {
            // ITEM PICKUP WINDOW - standard rendering
            this.drawItemPickupWindow(win);
        }
        
        // Draw context menu on top if present
        if (activeContextMenu) {
            this.drawContextMenu();
        }
    },
    
    drawExamineWindow: function(win) { // LOTS OF HARDCODED POSITIONS!!!
        // Draw entity sprite at top
        if (win.entity) {
            const spriteSize = tileSize * 2;
            const spriteY = win.y + 10;
            const spriteX = win.x + (win.width / 2) - (spriteSize / 2);
            
            // Draw entity using game's rendering method
            const entity = win.entity;
            //const color = entity === player ? "rgba(0, 0, 255, 0.5)" : "rgba(125, 125, 0, 0.5)";
            const imgId = entity === player ? "pep" : "enemy";
            
            //ctx.fillStyle = color;
            //ctx.fillRect(spriteX, spriteY, spriteSize, spriteSize);
            
            const img = document.getElementById(imgId);
            if (img && img.complete) {
                ctx.drawImage(img, spriteX, spriteY, spriteSize, spriteSize);
            }
            
			// Draw entity name and HP below sprite
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 16px monospace";
            ctx.textAlign = "center";
            ctx.fillText(entity.name, spriteX + spriteSize / 2, spriteY + spriteSize + 20);
        	ctx.font = "14px monospace";
			ctx.fillText(" (X: "+entity.x+", Y: "+entity.y+") ", spriteX + spriteSize / 2, spriteY + spriteSize + 35);
            //ctx.fillText(entity.hp + " HP", spriteX + spriteSize / 2, spriteY + spriteSize + 40);
        }
        
        // Draw stats
        const contentY = win.y + (tileSize * 2) + 60;
        ctx.fillStyle = "#ffffff";
        ctx.font = "14px monospace";
        ctx.textAlign = "left";
        
        for (let i = 0; i < win.items.length; i++) {
            const item = win.items[i];
            const itemY = contentY + (i * 20);
            ctx.fillText(item.text, win.x + win.padding + 10, itemY);
        }
        
        // Draw footer message
        const footerY = win.y + win.height - 12;
        ctx.fillStyle = "#888888";
        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Press ESC or click outside to close", win.x + win.width / 2, footerY);
    },
    
    drawItemPickupWindow: function(win) {
        // Calculate content area
        const contentY = win.y + win.headerHeight;
        const contentHeight = win.height - win.headerHeight - win.footerHeight;
        const maxVisibleItems = Math.floor((contentHeight - win.padding * 2) / win.itemHeight);
        
        // Draw items
        ctx.textAlign = "left";
        ctx.font = "14px monospace";
        
        const startIndex = Math.floor(win.scrollOffset);
        const endIndex = Math.min(win.items.length, startIndex + maxVisibleItems);
        
        for (let i = startIndex; i < endIndex; i++) {
            const item = win.items[i];
            const itemY = contentY + win.padding + (i - startIndex) * win.itemHeight;
            
            // Determine background color
            let bgColor = "#000000";
            if (win.selectedIndices.has(i)) {
                bgColor = "#004400";
            } else if (i === win.hoveredIndex) {
                bgColor = "#333333";
            }
            
            // Draw item background
            ctx.fillStyle = bgColor;
            ctx.fillRect(win.x + win.padding, itemY, win.width - win.padding * 2, win.itemHeight);
            
            // Draw item border
            ctx.strokeStyle = win.selectedIndices.has(i) ? "#00ff00" : "#666666";
            ctx.lineWidth = 1;
            ctx.strokeRect(win.x + win.padding, itemY, win.width - win.padding * 2, win.itemHeight);
            
            // Draw checkbox
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
            
            // Draw item text with letter label
            const label = this.getItemLabel(i);
            ctx.fillStyle = "#ffffff";
            ctx.font = "14px monospace";
            ctx.fillText("(" + label + ") " + item.text, checkboxX + checkboxSize + 10, itemY + 20);
        }
        
        // Draw scrollbar if needed
        if (win.items.length > maxVisibleItems) {
            const scrollbarX = win.x + win.width - 15;
            const scrollbarHeight = contentHeight - 10;
            const scrollbarY = contentY + 5;
            
            // Scrollbar track
            ctx.fillStyle = "#333333";
            ctx.fillRect(scrollbarX, scrollbarY, 10, scrollbarHeight);
            
            // Scrollbar thumb
            const thumbHeight = Math.max(20, (maxVisibleItems / win.items.length) * scrollbarHeight);
            const thumbY = scrollbarY + (win.scrollOffset / win.items.length) * scrollbarHeight;
            ctx.fillStyle = "#666666";
            ctx.fillRect(scrollbarX, thumbY, 10, thumbHeight);
        }
        
        // Draw footer buttons
        const footerY = win.y + win.height - win.footerHeight;
        const buttonWidth = 100;
        const buttonHeight = 25;
        const buttonY = footerY + 8;
        const confirmX = win.x + win.width - buttonWidth - 110;
        const cancelX = win.x + win.width - buttonWidth - 10;
        
        // Confirm button
        ctx.fillStyle = win.selectedIndices.size > 0 ? "#00aa00" : "#333333";
        ctx.fillRect(confirmX, buttonY, buttonWidth, buttonHeight);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.strokeRect(confirmX, buttonY, buttonWidth, buttonHeight);
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText("Take Items", confirmX + buttonWidth / 2, buttonY + 17);
        
        // Cancel button
        ctx.fillStyle = "#aa0000";
        ctx.fillRect(cancelX, buttonY, buttonWidth, buttonHeight);
        ctx.strokeStyle = "#ffffff";
        ctx.strokeRect(cancelX, buttonY, buttonWidth, buttonHeight);
        ctx.fillStyle = "#ffffff";
        ctx.fillText("Cancel", cancelX + buttonWidth / 2, buttonY + 17);
    },
    
    handleClick: function(mouseX, mouseY) {
        // Context menu takes priority
        if (activeContextMenu) {
            return this.handleContextMenuClick(mouseX, mouseY);
        }
        
        if (!activeWindow) return false;
        
        const win = activeWindow;
        
        // For examine windows, clicking outside closes them
        if (win.isExamineWindow) {
            if (mouseX < win.x || mouseX > win.x + win.width ||
                mouseY < win.y || mouseY > win.y + win.height) {
                this.close();
                return true;
            }
            // Clicking inside does nothing
            return true;
        }
        
        // Check button clicks first (they're in the footer area)
        const footerY = win.y + win.height - win.footerHeight;
        const buttonWidth = 100;
        const buttonHeight = 25;
        const buttonY = footerY + 8;
        const confirmX = win.x + win.width - buttonWidth - 110;
        const cancelX = win.x + win.width - buttonWidth - 10;
        
        // Confirm button
        if (mouseX >= confirmX && mouseX <= confirmX + buttonWidth &&
            mouseY >= buttonY && mouseY <= buttonY + buttonHeight &&
            win.selectedIndices.size > 0) {
            this.confirm();
            return true;
        }
        
        // Cancel button
        if (mouseX >= cancelX && mouseX <= cancelX + buttonWidth &&
            mouseY >= buttonY && mouseY <= buttonY + buttonHeight) {
            this.cancel();
            return true;
        }
        
        // Check if click is outside window - close it
        if (mouseX < win.x || mouseX > win.x + win.width ||
            mouseY < win.y || mouseY > win.y + win.height) {
            this.cancel();
            return true;
        }
        
        const contentY = win.y + win.headerHeight;
        const contentHeight = win.height - win.headerHeight - win.footerHeight;
        const maxVisibleItems = Math.floor((contentHeight - win.padding * 2) / win.itemHeight);
        const startIndex = Math.floor(win.scrollOffset);
        
        // Check item clicks
        for (let i = startIndex; i < Math.min(win.items.length, startIndex + maxVisibleItems); i++) {
            const itemY = contentY + win.padding + (i - startIndex) * win.itemHeight;
            
            if (mouseX >= win.x + win.padding && 
                mouseX <= win.x + win.width - win.padding &&
                mouseY >= itemY && 
                mouseY <= itemY + win.itemHeight) {
                
                // Toggle selection
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
        // Context menu takes priority
        if (activeContextMenu) {
            return this.handleContextMenuMove(mouseX, mouseY);
        }
        
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
        // Context menu takes priority
        if (activeContextMenu) {
            return this.handleContextMenuKeyboard(event);
        }
        
        if (!activeWindow) return false;
        
        const win = activeWindow;
        
        // For examine windows, only ESC closes them
        if (win.isExamineWindow) {
            if (event.keyCode === 27 && event.type === 'keydown') {
                event.preventDefault();
                this.close();
                return true;
            }
            // Consume all other keys
            event.preventDefault();
            return true;
        }
        
        // Only handle letter/number keys on keydown to prevent toggle on keyup
        if (event.type === 'keydown' && event.key && event.key.length === 1) {
            const index = this.getIndexFromKey(event.key);
            if (index >= 0 && index < win.items.length) {
                event.preventDefault();
                // Toggle selection for this item
                if (win.selectedIndices.has(index)) {
                    win.selectedIndices.delete(index);
                } else {
                    win.selectedIndices.add(index);
                }
                // Update hovered index to show which was just toggled
                win.hoveredIndex = index;
                update();
                return true;
            }
        }
        
        // Only handle navigation keys on keydown
        if (event.type !== 'keydown') return false;
        
        // Arrow keys - navigate items
        if (event.keyCode === 38) { // Up arrow
            event.preventDefault();
            if (win.hoveredIndex > 0) {
                win.hoveredIndex--;
                update();
            }
            return true;
        }
        
        if (event.keyCode === 40) { // Down arrow
            event.preventDefault();
            if (win.hoveredIndex < win.items.length - 1) {
                win.hoveredIndex++;
                update();
            } else if (win.hoveredIndex === -1 && win.items.length > 0) {
                win.hoveredIndex = 0;
                update();
            }
            return true;
        }
        
        if (event.keyCode === 13) { // Enter
            event.preventDefault();
            this.confirm();
            return true;
        }
        
        if (event.keyCode === 27) { // Escape
            event.preventDefault();
            this.cancel();
            return true;
        }
        
        if (event.keyCode === 32) { // Space - toggle current hovered
            event.preventDefault();
            if (win.hoveredIndex >= 0) {
                if (win.selectedIndices.has(win.hoveredIndex)) {
                    win.selectedIndices.delete(win.hoveredIndex);
                } else {
                    win.selectedIndices.add(win.hoveredIndex);
                }
                update();
            }
            return true;
        }
        
        // Consume all other key events to prevent game hotkeys
        event.preventDefault();
        return true;
    },
    
    confirm: function() {
        if (!activeWindow) return;
        
        const win = activeWindow;
        if (win.onConfirm && win.selectedIndices.size > 0) {
            const selectedItems = Array.from(win.selectedIndices).map(i => win.items[i]);
            win.onConfirm(selectedItems);
        }
        this.close();
    },
    
    cancel: function() {
        if (!activeWindow) return;
        
        const win = activeWindow;
        if (win.onCancel) {
            win.onCancel();
        }
        this.close();
    },
    
    isOpen: function() {
        return activeWindow !== null;
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
            width: 150
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
        
        // Draw menu background
        ctx.fillStyle = "#000000";
        ctx.fillRect(menu.x, menu.y, menu.width, height);
        
        // Draw menu border
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.strokeRect(menu.x, menu.y, menu.width, height);
        
        // Draw options
        ctx.font = "14px monospace";
        ctx.textAlign = "left";
        
        for (let i = 0; i < menu.options.length; i++) {
            const option = menu.options[i];
            const itemY = menu.y + menu.padding + i * menu.itemHeight;
            
            // Highlight hovered option
            if (i === menu.hoveredIndex) {
                ctx.fillStyle = "#333333";
                ctx.fillRect(menu.x + menu.padding, itemY, menu.width - menu.padding * 2, menu.itemHeight);
            }
            
            // Draw option text
            ctx.fillStyle = "#ffffff";
            ctx.fillText(option.text, menu.x + menu.padding + 5, itemY + 17);
        }
    },
    
    handleContextMenuMove: function(mouseX, mouseY) {
        if (!activeContextMenu) return false;
        
        const menu = activeContextMenu;
        const height = menu.options.length * menu.itemHeight + menu.padding * 2;
        
        // Check if mouse is outside menu AND outside the tile
        const tileScreenX = (menu.tileX - camera.x) * tileSize;
        const tileScreenY = (menu.tileY - camera.y) * tileSize;
        
        const inMenu = mouseX >= menu.x && mouseX <= menu.x + menu.width &&
                       mouseY >= menu.y && mouseY <= menu.y + height;
        
        const inTile = mouseX >= tileScreenX && mouseX <= tileScreenX + tileSize &&
                       mouseY >= tileScreenY && mouseY <= tileScreenY + tileSize;
        
        if (!inMenu && !inTile) {
            this.closeContextMenu();
            return true;
        }
        
        if (!inMenu) {
            menu.hoveredIndex = -1;
            update();
            return true;
        }
        
        // Update hovered option
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
        
        // Check if click is inside menu
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
        
        // Click outside menu - close it
        this.closeContextMenu();
        return true;
    },
    
    handleContextMenuKeyboard: function(event) {
        if (!activeContextMenu) return false;
        
        const menu = activeContextMenu;
        
        // Get the actual key pressed - event.key is most reliable
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
        
        // Escape to close
        if (event.keyCode === 27 || event.key === 'Escape') {
            event.preventDefault();
            this.closeContextMenu();
            return true;
        }
        
        // Consume all keys to prevent game actions
        event.preventDefault();
        return true;
    },
    
    showExamineWindow: function(entity) {
        const stats = [];
        
        stats.push({ text: `HP: ${entity.hp}${entity.maxHp ? '/' + entity.maxHp : ''}` });
        stats.push({ text: `Movement: ${entity.range}` });
        stats.push({ text: `Attack Range: ${entity.attack_range}` });
        
        if (entity.damage) {
            stats.push({ text: `Damage: +${entity.damage}` });
        }
        
        if (entity.armor) {
            stats.push({ text: `Armor: ${entity.armor}` });
        }
        
        // Equipment info
        if (entity.equipment) {
            stats.push({ text: "" }); // Blank line
            stats.push({ text: "EQUIPMENT:" });
            
            if (entity.equipment.weapon) {
                const weaponDef = itemTypes[entity.equipment.weapon.itemType];
                const ammo = entity.equipment.weapon.currentAmmo;
                const maxAmmo = weaponDef.maxAmmo;
                let weaponText = `  Weapon: ${weaponDef.displayName}`;
                if (maxAmmo !== undefined) {
                    weaponText += ` [${ammo}/${maxAmmo}]`;
                }
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
        
        // Inventory
        if (entity.inventory && entity.inventory.length > 0) {
            stats.push({ text: "" }); // Blank line
            stats.push({ text: `INVENTORY (${entity.inventory.length} items):` });
            entity.inventory.forEach(item => {
                const itemDef = itemTypes[item.itemType];
                let itemText = `  - ${itemDef.displayName}`;
                if (item.quantity > 1) {
                    itemText += ` (x${item.quantity})`;
                }
                if (item.currentAmmo !== undefined) {
                    itemText += ` [${item.currentAmmo}/${itemDef.maxAmmo}]`;
                }
                stats.push({ text: itemText });
            });
        }
        
        // Traits
        if (entity.traits && entity.traits.length > 0) {
            stats.push({ text: `Traits: ${entity.traits.join(', ')}` });
        }
        
        // Special flags
        if (entity.isGrenade) {
            stats.push({ text: `Grenade Countdown: ${entity.turnsRemaining}` });
        }
        
        const window = this.create({
            title: `${entity.name}`,
            width: 400,
            height: Math.min(600, 200 + stats.length * 22),
            items: stats,
            selectedIndices: new Set(),
            isExamineWindow: true,
            entity: entity,
            onConfirm: null,
            onCancel: function() {
                //console.log("Closed examine window");
            }
        });
        
        this.open(window);
    }
};
