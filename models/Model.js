// Dữ liệu in-memory (có thể thay bằng database như MongoDB sau)
const data = [
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' }
];

module.exports = {
    getAll: () => data,
    getById: (id) => data.find(item => item.id === id),
    add: (newItem) => {
        newItem.id = data.length + 1;
        data.push(newItem);
    }
};