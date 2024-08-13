document.addEventListener('DOMContentLoaded', () => {
    const itemsTableBody = document.querySelector('#items tbody');
    const cardsDiv = document.getElementById('cards');
    const emptyMessage = document.getElementById('empty-message');
    const addItemButton = document.getElementById('add-item');
    const filterSelect = document.getElementById('filter-select');
    const sortSelect = document.getElementById('sort-select');
    const listViewIcon = document.getElementById('list-view');
    const cardViewIcon = document.getElementById('card-view');
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const whoInput = document.getElementById('who');
    const whatInput = document.getElementById('what');
    const saveItemButton = document.getElementById('save-item');
    const cancelButton = document.getElementById('cancel');

    const helpIcon = document.getElementById('help-icon');
    const helpModal = document.getElementById('help-modal');
    const closeHelpButton = document.getElementById('close-help');

    let currentFilter = 'all';
    let currentSort = 'newest';
    let currentView = 'list';
    let editingIndex = null;

    // Utility function to display items
    function displayItems(items) {
        itemsTableBody.innerHTML = '';
        cardsDiv.innerHTML = '';
        emptyMessage.style.display = 'none';

        let filteredItems = items.filter(item => currentFilter === 'all' || item.status === currentFilter);

        // Sort the items based on the current sort order
        filteredItems.sort((a, b) => {
            const dateA = new Date(a.dateCreated).getTime();
            const dateB = new Date(b.dateCreated).getTime();
            return currentSort === 'newest' ? dateB - dateA : dateA - dateB;
        });

        if (filteredItems.length === 0) {
            emptyMessage.style.display = 'block';
        } else {
            filteredItems.forEach((item, index) => {
                if (currentView === 'list') {
                    addItemToTable(item, index, items.indexOf(item));
                } else {
                    addItemToCard(item, index, items.indexOf(item));
                }
            });
        }
    }

    // Load items from storage
    chrome.storage.sync.get(['parkingLotItems'], function(result) {
        const items = result.parkingLotItems || [];
        displayItems(items);
    });

    // Show modal to add new item
    addItemButton.addEventListener('click', () => {
        openModal('add');
    });

    // Save new or edited item
    saveItemButton.addEventListener('click', () => {
        const whoText = whoInput.value.trim();
        const whatText = whatInput.value.trim();
        if (whoText === '' || whatText === '') return;

        chrome.storage.sync.get(['parkingLotItems'], function(result) {
            const items = result.parkingLotItems || [];
            if (editingIndex !== null) {
                // Editing an existing item
                items[editingIndex].who = whoText;
                items[editingIndex].what = whatText;
                items[editingIndex].dateEdited = new Date().toLocaleString();
            } else {
                // Adding a new item
                const newItem = {
                    who: whoText,
                    what: whatText,
                    status: 'open',
                    dateCreated: new Date().toLocaleString(),
                    dateEdited: null,
                    dateClosed: null
                };
                items.push(newItem);
            }
            chrome.storage.sync.set({ parkingLotItems: items }, function() {
                displayItems(items);
                modal.style.display = 'none';
                whoInput.value = '';
                whatInput.value = '';
                editingIndex = null;
            });
        });
    });

    // Cancel adding or editing an item
    cancelButton.addEventListener('click', () => {
        modal.style.display = 'none';
        editingIndex = null;
    });

    // Handle filter changes
    filterSelect.addEventListener('change', () => {
        currentFilter = filterSelect.value;
        chrome.storage.sync.get(['parkingLotItems'], function(result) {
            const items = result.parkingLotItems || [];
            displayItems(items);
        });
    });

    // Handle sort changes
    sortSelect.addEventListener('change', () => {
        currentSort = sortSelect.value;
        chrome.storage.sync.get(['parkingLotItems'], function(result) {
            const items = result.parkingLotItems || [];
            displayItems(items);
        });
    });

    // Toggle List View
    listViewIcon.addEventListener('click', () => {
        setActiveView(listViewIcon);
        currentView = 'list';
        document.querySelector('#items').style.display = 'table';
        cardsDiv.style.display = 'none';
        chrome.storage.sync.get(['parkingLotItems'], function(result) {
            const items = result.parkingLotItems || [];
            displayItems(items);
        });
    });

    // Toggle Card View
    cardViewIcon.addEventListener('click', () => {
        setActiveView(cardViewIcon);
        currentView = 'card';
        document.querySelector('#items').style.display = 'none';
        cardsDiv.style.display = 'grid';
        chrome.storage.sync.get(['parkingLotItems'], function(result) {
            const items = result.parkingLotItems || [];
            displayItems(items);
        });
    });

    function setActiveView(activeIcon) {
        document.querySelectorAll('.view-toggle i').forEach(icon => {
            icon.classList.remove('active');
        });
        activeIcon.classList.add('active');
    }

    function addItemToTable(item, sortedIndex, originalIndex) {
        const row = document.createElement('tr');
        const whenText = item.status === 'closed'
            ? new Date(item.dateClosed).toLocaleString()
            : item.dateEdited
            ? new Date(item.dateEdited).toLocaleString()
            : new Date(item.dateCreated).toLocaleString();

        row.innerHTML = `
            <td>${item.who}</td>
            <td>${item.what}</td>
            <td>${whenText}</td>
            <td class="status-icon">
                <i class="fas ${item.status === 'open' ? 'fa-check-circle' : 'fa-times-circle'}"
                   style="color: ${item.status === 'open' ? 'green' : 'red'}; cursor: pointer;"
                   title="${item.status === 'open' ? 'Mark as closed' : 'Mark as open'}"></i>
                <i class="fas fa-trash-alt"
                   style="color: #808080; cursor: pointer; margin-left: 10px;"
                   title="Delete item"></i>
            </td>
        `;

        // Enable row click to open the edit modal with the correct original index
        row.addEventListener('click', () => {
            openModal('edit', originalIndex);
        });

        // Make the status icon clickable to toggle the status
        row.querySelector('.fa-check-circle, .fa-times-circle').addEventListener('click', (event) => {
            event.stopPropagation(); // Prevents row click from triggering the edit modal
            toggleStatus(originalIndex);
        });

        // Make the trash icon clickable to delete the item
        row.querySelector('.fa-trash-alt').addEventListener('click', (event) => {
            event.stopPropagation(); // Prevents row click from triggering the edit modal
            deleteItem(originalIndex);
        });

        itemsTableBody.appendChild(row);
    }

    function addItemToCard(item, sortedIndex, originalIndex) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        const whenText = item.status === 'closed'
            ? new Date(item.dateClosed).toLocaleString()
            : item.dateEdited
            ? new Date(item.dateEdited).toLocaleString()
            : new Date(item.dateCreated).toLocaleString();

        cardDiv.innerHTML = `
            <span><strong>Who:</strong> ${item.who}</span>
            <span><strong>What:</strong> ${item.what}</span>
            <span class="when-text"><strong>When:</strong> ${whenText}</span>
            <span class="status-icon">
                <i class="fas ${item.status === 'open' ? 'fa-check-circle' : 'fa-times-circle'}"
                   style="color: ${item.status === 'open' ? 'green' : 'red'}; cursor: pointer;"
                   title="${item.status === 'open' ? 'Mark as closed' : 'Mark as open'}"></i>
                <i class="fas fa-trash-alt"
                   style="color: #808080; cursor: pointer; margin-left: 10px;"
                   title="Delete item"></i>
            </span>
        `;

        // Enable card click to open the edit modal with the correct original index
        cardDiv.addEventListener('click', () => {
            openModal('edit', originalIndex);
        });

        // Make the status icon clickable to toggle the status
        cardDiv.querySelector('.fa-check-circle, .fa-times-circle').addEventListener('click', (event) => {
            event.stopPropagation();
            toggleStatus(originalIndex);
        });

        // Make the trash icon clickable to delete the item
        cardDiv.querySelector('.fa-trash-alt').addEventListener('click', (event) => {
            event.stopPropagation();
            deleteItem(originalIndex);
        });

        cardsDiv.appendChild(cardDiv);
    }

    function openModal(mode, index = null) {
        modal.style.display = 'flex';
        if (mode === 'edit') {
            modalTitle.textContent = 'Edit Parking Lot Item';
            chrome.storage.sync.get(['parkingLotItems'], function(result) {
                const items = result.parkingLotItems || [];
                const item = items[index];
                whoInput.value = item.who;
                whatInput.value = item.what;
                editingIndex = index;
            });
        } else {
            modalTitle.textContent = 'Add Parking Lot Item';
            whoInput.value = '';
            whatInput.value = '';
            editingIndex = null;
        }
    }

    function toggleStatus(index) {
        chrome.storage.sync.get(['parkingLotItems'], function(result) {
            const items = result.parkingLotItems || [];
            if (items[index].status === 'open') {
                items[index].status = 'closed';
                items[index].dateClosed = new Date().toLocaleString();
                items[index].dateEdited = null; // Reset the "Updated" status
            } else {
                items[index].status = 'open';
                items[index].dateClosed = null;
                // Do not set dateEdited here, since reopening should not be considered as "Updated"
            }
            chrome.storage.sync.set({ parkingLotItems: items }, function() {
                displayItems(items);
            });
        });
    }

    function deleteItem(index) {
        chrome.storage.sync.get(['parkingLotItems'], function(result) {
            let items = result.parkingLotItems || [];
            items.splice(index, 1); // Remove the item from the array
            chrome.storage.sync.set({ parkingLotItems: items }, function() {
                displayItems(items);
            });
        });
    }

    // Show help modal when the help icon is clicked
    helpIcon.addEventListener('click', () => {
        helpModal.style.display = 'flex';
    });

    // Close help modal when the close button is clicked
    closeHelpButton.addEventListener('click', () => {
        helpModal.style.display = 'none';
    });

    // Close help modal if the user clicks outside the modal content
    window.addEventListener('click', (event) => {
        if (event.target === helpModal) {
            helpModal.style.display = 'none';
        }
    });
}); 
