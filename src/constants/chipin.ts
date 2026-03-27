export const PROJECT_NAME = 'Chipin';

// Expense categories with subcategories
export const EXPENSE_CATEGORIES = {
    food: {
        emoji: '🍽️',
        subcategories: [
            { key: 'groceries', emoji: '🛒' },
            { key: 'restaurants', emoji: '🍝' },
            { key: 'fast_food', emoji: '🍔' },
            { key: 'coffee', emoji: '☕' },
            { key: 'food_delivery', emoji: '🛵' },
        ],
    },

    transport: {
        emoji: '🚕',
        subcategories: [
            { key: 'taxi', emoji: '🚕' },
            { key: 'public_transport', emoji: '🚌' },
            { key: 'fuel', emoji: '⛽' },
            { key: 'vehicle_rent', emoji: '🚗' },
            { key: 'parking', emoji: '🅿️' },
            { key: 'vehicle_repair', emoji: '🔧' },
            { key: 'vehicle_insurance', emoji: '📄' },
        ],
    },

    housing: {
        emoji: '🏠',
        subcategories: [
            { key: 'rent', emoji: '🏘️' },
            { key: 'mortgage', emoji: '🏦' },
            { key: 'electricity', emoji: '⚡' },
            { key: 'water', emoji: '💧' },
            { key: 'gas', emoji: '🔥' },
            { key: 'internet', emoji: '🌐' },
            { key: 'mobile', emoji: '📱' },
            { key: 'furniture', emoji: '🛋️' },
            { key: 'home_repair', emoji: '🛠️' },
            { key: 'cleaning_services', emoji: '🧹' },
        ],
    },

    shopping: {
        emoji: '🛍️',
        subcategories: [
            { key: 'clothes', emoji: '👕' },
            { key: 'shoes', emoji: '👟' },
            { key: 'electronics', emoji: '💻' },
            { key: 'household_items', emoji: '🧴' },
            { key: 'online_orders', emoji: '📦' },
            { key: 'gifts', emoji: '🎁' },
        ],
    },

    health: {
        emoji: '🩺',
        subcategories: [
            { key: 'pharmacy', emoji: '💊' },
            { key: 'doctor', emoji: '🩺' },
            { key: 'medical_tests', emoji: '🧪' },
            { key: 'dental', emoji: '🦷' },
            { key: 'health_insurance', emoji: '🛡️' },
        ],
    },

    lifestyle: {
        emoji: '🎉',
        subcategories: [
            { key: 'bars', emoji: '🍸' },
            { key: 'cinema', emoji: '🎬' },
            { key: 'clubs', emoji: '🎧' },
            { key: 'concerts', emoji: '🎤' },
            { key: 'games', emoji: '🎮' },
            { key: 'gym', emoji: '🏋️' },
            { key: 'fitness', emoji: '🤸' },
            { key: 'sports_equipment', emoji: '🥊' },
            { key: 'haircut', emoji: '✂️' },
            { key: 'spa', emoji: '♨️' },
            { key: 'massage', emoji: '💆' },
            { key: 'cosmetics', emoji: '💄' },
        ],
    },

    subscriptions: {
        emoji: '📺',
        subcategories: [
            { key: 'streaming', emoji: '📺' },
            { key: 'software', emoji: '🧑‍💻' },
            { key: 'cloud_services', emoji: '☁️' },
            { key: 'vpn', emoji: '🔐' },
        ],
    },

    travel: {
        emoji: '✈️',
        subcategories: [
            { key: 'flights', emoji: '✈️' },
            { key: 'accommodation', emoji: '🏨' },
            { key: 'visa', emoji: '🛂' },
            { key: 'travel_insurance', emoji: '🧳' },
            { key: 'tours', emoji: '🗺️' },
        ],
    },

    education: {
        emoji: '📚',
        subcategories: [
            { key: 'courses', emoji: '🧑‍🏫' },
            { key: 'books', emoji: '📚' },
            { key: 'online_learning', emoji: '💻' },
        ],
    },

    finance: {
        emoji: '💳',
        subcategories: [
            { key: 'bank_fees', emoji: '🏦' },
            { key: 'taxes', emoji: '🧾' },
            { key: 'loan_interest', emoji: '📉' },
            { key: 'investments', emoji: '📈' },
            { key: 'crypto', emoji: '🪙' },
        ],
    },

    government: {
        emoji: '🏛️',
        subcategories: [
            { key: 'fines', emoji: '🚨' },
            { key: 'documents', emoji: '📄' },
            { key: 'legal_fees', emoji: '⚖️' },
        ],
    },

    family: {
        emoji: '👨‍👩‍👧',
        subcategories: [
            { key: 'kids_products', emoji: '🧸' },
            { key: 'school', emoji: '🏫' },
            { key: 'babysitter', emoji: '👶' },
        ],
    },

    pets: {
        emoji: '🐾',
        subcategories: [
            { key: 'pet_food', emoji: '🦴' },
            { key: 'veterinary', emoji: '🏥' },
            { key: 'pet_toys', emoji: '🎾' },
            { key: 'grooming', emoji: '🛁' },
        ],
    },

    transfers: {
        emoji: '💸',
        subcategories: [
            { key: 'cash_withdrawal', emoji: '💵' },
            { key: 'account_transfer', emoji: '🔁' },
            { key: 'currency_exchange', emoji: '💱' },
        ],
    },

    charity: {
        emoji: '❤️',
        subcategories: [
            { key: 'donations', emoji: '🤲' },
            { key: 'family_support', emoji: '💞' },
        ],
    },

    other: {
        emoji: '🧾',
        subcategories: [
            { key: 'unexpected', emoji: '⚠️' },
            { key: 'misc', emoji: '📌' },
        ],
    },
} as const;

export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

export type ExpenseSubcategory<T extends ExpenseCategory = ExpenseCategory> =
    (typeof EXPENSE_CATEGORIES)[T]['subcategories'][number]['key'];
