export const PROJECT_NAME = 'Chipin';

// Expense categories with subcategories
export const EXPENSE_CATEGORIES = {
    food: {
        emoji: '🍽️',
        icon: 'Utensils',
        subcategories: [
            { key: 'groceries', emoji: '🛒', icon: 'ShoppingCart' },
            { key: 'restaurants', emoji: '🍝', icon: 'UtensilsCrossed' },
            { key: 'fast_food', emoji: '🍔', icon: 'Sandwich' },
            { key: 'coffee', emoji: '☕', icon: 'Coffee' },
            { key: 'food_delivery', emoji: '🛵', icon: 'Bike' },
        ],
    },

    transport: {
        emoji: '🚕',
        icon: 'Car',
        subcategories: [
            { key: 'public_transport', emoji: '🚌', icon: 'Bus' },
            { key: 'taxi', emoji: '🚕', icon: 'CarTaxiFront' },
            { key: 'fuel', emoji: '⛽', icon: 'Fuel' },
            { key: 'vehicle_rent', emoji: '🚗', icon: 'CarFront' },
            { key: 'parking', emoji: '🅿️', icon: 'ParkingSquare' },
            { key: 'vehicle_repair', emoji: '🔧', icon: 'Wrench' },
            { key: 'vehicle_insurance', emoji: '📄', icon: 'Shield' },
            { key: 'tolls', emoji: '🛣️', icon: 'Route' },
        ],
    },

    housing: {
        emoji: '🏠',
        icon: 'Home',
        subcategories: [
            { key: 'rent', emoji: '🏘️', icon: 'Home' },
            { key: 'mortgage', emoji: '🏦', icon: 'Building2' },
            { key: 'utilities', emoji: '⚡', icon: 'Zap' },
            { key: 'home_maintenance', emoji: '🛠️', icon: 'Hammer' },
            { key: 'furnishing', emoji: '🛋️', icon: 'Sofa' },
        ],
    },

    digital: {
        emoji: '📱',
        icon: 'Wifi',
        subcategories: [
            { key: 'internet', emoji: '🌐', icon: 'Globe' },
            { key: 'mobile', emoji: '📱', icon: 'Smartphone' },
            { key: 'subscriptions', emoji: '📺', icon: 'Tv' },
            { key: 'software', emoji: '🧑‍💻', icon: 'Code' },
        ],
    },

    shopping: {
        emoji: '🛍️',
        icon: 'ShoppingBag',
        subcategories: [
            { key: 'clothing', emoji: '👕', icon: 'Shirt' },
            { key: 'electronics', emoji: '💻', icon: 'Laptop' },
            { key: 'home_goods', emoji: '🧴', icon: 'Package' },
            { key: 'personal_items', emoji: '🎒', icon: 'Backpack' },
            { key: 'gifts', emoji: '🎁', icon: 'Gift' },
        ],
    },

    lifestyle: {
        emoji: '🎉',
        icon: 'PartyPopper',
        subcategories: [
            { key: 'cinema', emoji: '🎬', icon: 'Film' },
            { key: 'events', emoji: '🎉', icon: 'CalendarDays' },
            { key: 'concerts', emoji: '🎤', icon: 'Music' },
            { key: 'games', emoji: '🎮', icon: 'Gamepad2' },
            { key: 'nightlife', emoji: '🍸', icon: 'Wine' },
        ],
    },

    personal_care: {
        emoji: '💆',
        icon: 'Sparkles',
        subcategories: [
            { key: 'haircut', emoji: '✂️', icon: 'Scissors' },
            { key: 'spa', emoji: '♨️', icon: 'Flower' },
            { key: 'massage', emoji: '💆', icon: 'HandHeart' },
            { key: 'beauty_services', emoji: '💅', icon: 'Sparkles' },
            { key: 'hygiene', emoji: '🧼', icon: 'Droplets' },
            { key: 'skincare', emoji: '🧴', icon: 'FlaskConical' },
            { key: 'cosmetics', emoji: '💄', icon: 'Paintbrush' },
        ],
    },

    sports: {
        emoji: '🏋️',
        icon: 'Dumbbell',
        subcategories: [
            { key: 'subscription', emoji: '🏋️', icon: 'Dumbbell' },
            { key: 'coach', emoji: '👨‍🏫', icon: 'PersonStanding' },
            { key: 'equipment', emoji: '🥊', icon: 'ShoppingBag' },
        ],
    },

    health: {
        emoji: '🩺',
        icon: 'HeartPulse',
        subcategories: [
            { key: 'medical', emoji: '🩺', icon: 'Stethoscope' },
            { key: 'pharmacy', emoji: '💊', icon: 'Pill' },
            { key: 'dental', emoji: '🦷', icon: 'SmilePlus' },
            { key: 'health_insurance', emoji: '🛡️', icon: 'ShieldPlus' },
        ],
    },

    travel: {
        emoji: '✈️',
        icon: 'Plane',
        subcategories: [
            { key: 'flights', emoji: '✈️', icon: 'Plane' },
            { key: 'accommodation', emoji: '🏨', icon: 'Hotel' },
            { key: 'activities', emoji: '🗺️', icon: 'MapPin' },
            { key: 'visa', emoji: '🛂', icon: 'FileText' },
            { key: 'insurance', emoji: '🧳', icon: 'ShieldCheck' },
        ],
    },

    education: {
        emoji: '📚',
        icon: 'GraduationCap',
        subcategories: [
            { key: 'online_courses', emoji: '💻', icon: 'GraduationCap' },
            { key: 'books', emoji: '📚', icon: 'BookOpen' },
            { key: 'tutoring', emoji: '👨‍🏫', icon: 'Users' },
            { key: 'certification', emoji: '📜', icon: 'Award' },
        ],
    },

    finance: {
        emoji: '💳',
        icon: 'CreditCard',
        subcategories: [
            { key: 'fees', emoji: '🏦', icon: 'Landmark' },
            { key: 'taxes', emoji: '🧾', icon: 'Receipt' },
            { key: 'loans', emoji: '📉', icon: 'TrendingDown' },
            { key: 'investments', emoji: '📈', icon: 'TrendingUp' },
            { key: 'crypto', emoji: '🪙', icon: 'Bitcoin' },
            { key: 'currency_exchange', emoji: '💱', icon: 'ArrowLeftRight' },
            { key: 'cash_withdrawal', emoji: '💵', icon: 'Banknote' },
            { key: 'transfers', emoji: '🔁', icon: 'RefreshCw' },
        ],
    },

    pets: {
        emoji: '🐾',
        icon: 'PawPrint',
        subcategories: [
            { key: 'pet_food', emoji: '🦴', icon: 'PawPrint' },
            { key: 'vet', emoji: '🏥', icon: 'HeartPulse' },
            { key: 'pet_items', emoji: '🎾', icon: 'ShoppingBag' },
        ],
    },

    other: {
        emoji: '🧾',
        icon: 'MoreHorizontal',
        subcategories: [],
    },
} as const;

export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

export type ExpenseSubcategory<T extends ExpenseCategory = ExpenseCategory> =
    (typeof EXPENSE_CATEGORIES)[T]['subcategories'][number]['key'];
