export const PROJECT_NAME = 'Chipin';

export const EXPENSE_SPLIT_MODES = {
    EQUAL: 'equal',
    PERCENT: 'percent',
    AMOUNTS: 'amounts',
    SHARES: 'shares',
} as const;

export type ExpenseSplitMode =
    (typeof EXPENSE_SPLIT_MODES)[keyof typeof EXPENSE_SPLIT_MODES];

export const EXPENSE_SPLIT_STATUSES = {
    EXACT: 'exact',
    UNDER: 'under',
    OVER: 'over',
} as const;

export type ExpenseSplitStatus =
    (typeof EXPENSE_SPLIT_STATUSES)[keyof typeof EXPENSE_SPLIT_STATUSES];

// Expense categories with subcategories
export const EXPENSE_CATEGORIES = {
    food: {
        emoji: '🍽️',
        icon: 'Utensils',
        color: 'orange',
        subcategories: [
            { key: 'groceries', emoji: '🛒', icon: 'ShoppingCart', color: 'green' },
            { key: 'restaurants', emoji: '🍝', icon: 'UtensilsCrossed', color: 'orange' },
            { key: 'fast_food', emoji: '🍔', icon: 'Sandwich', color: 'red' },
            { key: 'coffee', emoji: '☕', icon: 'Coffee', color: 'brown' },
            { key: 'food_delivery', emoji: '🛵', icon: 'Bike', color: 'amber' },
        ],
    },

    transport: {
        emoji: '🚕',
        icon: 'Car',
        color: 'blue',
        subcategories: [
            { key: 'public_transport', emoji: '🚌', icon: 'Bus', color: 'blue' },
            { key: 'taxi', emoji: '🚕', icon: 'CarTaxiFront', color: 'amber' },
            { key: 'fuel', emoji: '⛽', icon: 'Fuel', color: 'orange' },
            { key: 'vehicle_rent', emoji: '🚗', icon: 'CarFront', color: 'sky' },
            { key: 'parking', emoji: '🅿️', icon: 'ParkingSquare', color: 'gray' },
            { key: 'vehicle_repair', emoji: '🔧', icon: 'Wrench', color: 'brown' },
            { key: 'vehicle_insurance', emoji: '📄', icon: 'Shield', color: 'indigo' },
            { key: 'tolls', emoji: '🛣️', icon: 'Route', color: 'teal' },
        ],
    },

    housing: {
        emoji: '🏠',
        icon: 'Home',
        color: 'amber',
        subcategories: [
            { key: 'rent', emoji: '🏘️', icon: 'Home', color: 'amber' },
            { key: 'mortgage', emoji: '🏦', icon: 'Building2', color: 'brown' },
            { key: 'utilities', emoji: '⚡', icon: 'Zap', color: 'yellow' },
            { key: 'home_maintenance', emoji: '🛠️', icon: 'Hammer', color: 'orange' },
            { key: 'furnishing', emoji: '🛋️', icon: 'Sofa', color: 'teal' },
        ],
    },

    digital: {
        emoji: '📱',
        icon: 'Wifi',
        color: 'violet',
        subcategories: [
            { key: 'internet', emoji: '🌐', icon: 'Globe', color: 'sky' },
            { key: 'mobile', emoji: '📱', icon: 'Smartphone', color: 'violet' },
            { key: 'subscriptions', emoji: '📺', icon: 'Tv', color: 'purple' },
            { key: 'software', emoji: '🧑‍💻', icon: 'Code', color: 'indigo' },
        ],
    },

    shopping: {
        emoji: '🛍️',
        icon: 'ShoppingBag',
        color: 'crimson',
        subcategories: [
            { key: 'clothing', emoji: '👕', icon: 'Shirt', color: 'crimson' },
            { key: 'electronics', emoji: '💻', icon: 'Laptop', color: 'blue' },
            { key: 'home_goods', emoji: '🧴', icon: 'Package', color: 'teal' },
            { key: 'personal_items', emoji: '🎒', icon: 'Backpack', color: 'brown' },
            { key: 'gifts', emoji: '🎁', icon: 'Gift', color: 'pink' },
        ],
    },

    lifestyle: {
        emoji: '🎉',
        icon: 'PartyPopper',
        color: 'purple',
        subcategories: [
            { key: 'cinema', emoji: '🎬', icon: 'Film', color: 'purple' },
            { key: 'events', emoji: '🎉', icon: 'CalendarDays', color: 'orange' },
            { key: 'concerts', emoji: '🎤', icon: 'Music', color: 'red' },
            { key: 'games', emoji: '🎮', icon: 'Gamepad2', color: 'indigo' },
            { key: 'nightlife', emoji: '🍸', icon: 'Wine', color: 'violet' },
        ],
    },

    personal_care: {
        emoji: '💆',
        icon: 'Sparkles',
        color: 'pink',
        subcategories: [
            { key: 'haircut', emoji: '✂️', icon: 'Scissors', color: 'amber' },
            { key: 'spa', emoji: '♨️', icon: 'Flower', color: 'teal' },
            { key: 'massage', emoji: '💆', icon: 'HandHeart', color: 'green' },
            { key: 'beauty_services', emoji: '💅', icon: 'Sparkles', color: 'pink' },
            { key: 'hygiene', emoji: '🧼', icon: 'Droplets', color: 'sky' },
            { key: 'skincare', emoji: '🧴', icon: 'FlaskConical', color: 'mint' },
            { key: 'cosmetics', emoji: '💄', icon: 'Paintbrush', color: 'crimson' },
        ],
    },

    sports: {
        emoji: '🏋️',
        icon: 'Dumbbell',
        color: 'green',
        subcategories: [
            { key: 'subscription', emoji: '🏋️', icon: 'Dumbbell', color: 'green' },
            { key: 'coach', emoji: '👨‍🏫', icon: 'PersonStanding', color: 'blue' },
            { key: 'equipment', emoji: '🥊', icon: 'ShoppingBag', color: 'orange' },
        ],
    },

    health: {
        emoji: '🩺',
        icon: 'HeartPulse',
        color: 'red',
        subcategories: [
            { key: 'medical', emoji: '🩺', icon: 'Stethoscope', color: 'red' },
            { key: 'pharmacy', emoji: '💊', icon: 'Pill', color: 'green' },
            { key: 'dental', emoji: '🦷', icon: 'SmilePlus', color: 'sky' },
            { key: 'health_insurance', emoji: '🛡️', icon: 'ShieldPlus', color: 'blue' },
        ],
    },

    travel: {
        emoji: '✈️',
        icon: 'Plane',
        color: 'sky',
        subcategories: [
            { key: 'flights', emoji: '✈️', icon: 'Plane', color: 'sky' },
            { key: 'accommodation', emoji: '🏨', icon: 'Hotel', color: 'amber' },
            { key: 'activities', emoji: '🗺️', icon: 'MapPin', color: 'green' },
            { key: 'visa', emoji: '🛂', icon: 'FileText', color: 'indigo' },
            { key: 'insurance', emoji: '🧳', icon: 'ShieldCheck', color: 'blue' },
        ],
    },

    education: {
        emoji: '📚',
        icon: 'GraduationCap',
        color: 'indigo',
        subcategories: [
            { key: 'online_courses', emoji: '💻', icon: 'GraduationCap', color: 'indigo' },
            { key: 'books', emoji: '📚', icon: 'BookOpen', color: 'amber' },
            { key: 'tutoring', emoji: '👨‍🏫', icon: 'Users', color: 'green' },
            { key: 'certification', emoji: '📜', icon: 'Award', color: 'gold' },
        ],
    },

    finance: {
        emoji: '💳',
        icon: 'CreditCard',
        color: 'gold',
        subcategories: [
            { key: 'fees', emoji: '🏦', icon: 'Landmark', color: 'gray' },
            { key: 'taxes', emoji: '🧾', icon: 'Receipt', color: 'red' },
            { key: 'loans', emoji: '📉', icon: 'TrendingDown', color: 'orange' },
            { key: 'investments', emoji: '📈', icon: 'TrendingUp', color: 'green' },
            { key: 'crypto', emoji: '🪙', icon: 'Bitcoin', color: 'amber' },
            { key: 'currency_exchange', emoji: '💱', icon: 'ArrowLeftRight', color: 'blue' },
            { key: 'cash_withdrawal', emoji: '💵', icon: 'Banknote', color: 'gold' },
            { key: 'transfers', emoji: '🔁', icon: 'RefreshCw', color: 'violet' },
        ],
    },

    pets: {
        emoji: '🐾',
        icon: 'PawPrint',
        color: 'brown',
        subcategories: [
            { key: 'pet_food', emoji: '🦴', icon: 'PawPrint', color: 'amber' },
            { key: 'vet', emoji: '🏥', icon: 'HeartPulse', color: 'red' },
            { key: 'pet_items', emoji: '🎾', icon: 'ShoppingBag', color: 'teal' },
        ],
    },

    other: {
        emoji: '🧾',
        icon: 'MoreHorizontal',
        color: 'gray',
        subcategories: [],
    },
} as const;

export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

export type ExpenseSubcategory<T extends ExpenseCategory = ExpenseCategory> =
    (typeof EXPENSE_CATEGORIES)[T]['subcategories'][number]['key'];
