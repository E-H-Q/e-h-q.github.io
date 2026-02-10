// WINDOW.JS: SIMPLE WINDOW SYSTEM FOR CANVAS UI

var activeWindow = null;

var WindowSystem = {
    create: function(config) {
        const window = {
            title: config.title || "Window",
            x: config.x || 100,
            y: config.y || 100,
            width: config.width || 300,
            height: config.height || 200,
            items: config.items || [],
            selectedIndices: new Set(),
            hoveredIndex: 0, // Start with first item hovered
            onConfirm: config.onConfirm || null,
            onCancel: config.onCancel || null,
            scrollOffset: 0,
            itemHeight: 30,
            headerHeight: 0,
            footerHeight: 40,
            padding: 10
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
        if (!activeWindow) return;
        
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
            
            // Draw item text
            ctx.fillStyle = "#ffffff";
            ctx.fillText(item.text, checkboxX + checkboxSize + 10, itemY + 20);
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
        
        // Draw footer
        const footerY = win.y + win.height - win.footerHeight;
        
        // Draw buttons
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
        if (!activeWindow) return false;
        
        const win = activeWindow;
        
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
        if (!activeWindow) return false;
        
        const win = activeWindow;
        
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
        
        return false;
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
    }
};
