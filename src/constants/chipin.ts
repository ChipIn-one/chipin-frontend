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
        icon: 'Utensils',
        color: 'orange',
        subcategories: [
            { key: 'groceries', icon: 'ShoppingCart', color: 'green' },
            { key: 'restaurants', icon: 'UtensilsCrossed', color: 'orange' },
            { key: 'fast_food', icon: 'Sandwich', color: 'red' },
            { key: 'coffee', icon: 'Coffee', color: 'brown' },
            { key: 'food_delivery', icon: 'Bike', color: 'amber' },
        ],
    },

    transport: {
        icon: 'Car',
        color: 'blue',
        subcategories: [
            { key: 'public_transport', icon: 'Bus', color: 'blue' },
            { key: 'taxi', icon: 'CarTaxiFront', color: 'amber' },
            { key: 'fuel', icon: 'Fuel', color: 'orange' },
            { key: 'vehicle_rent', icon: 'CarFront', color: 'sky' },
            { key: 'parking', icon: 'ParkingSquare', color: 'gray' },
            { key: 'vehicle_repair', icon: 'Wrench', color: 'brown' },
            { key: 'vehicle_insurance', icon: 'Shield', color: 'indigo' },
            { key: 'tolls', icon: 'Route', color: 'teal' },
        ],
    },

    housing: {
        icon: 'Home',
        color: 'amber',
        subcategories: [
            { key: 'rent', icon: 'Home', color: 'amber' },
            { key: 'mortgage', icon: 'Building2', color: 'brown' },
            { key: 'utilities', icon: 'Zap', color: 'yellow' },
            { key: 'home_maintenance', icon: 'Hammer', color: 'orange' },
            { key: 'furnishing', icon: 'Sofa', color: 'teal' },
        ],
    },

    digital: {
        icon: 'Wifi',
        color: 'violet',
        subcategories: [
            { key: 'internet', icon: 'Globe', color: 'sky' },
            { key: 'mobile', icon: 'Smartphone', color: 'violet' },
            { key: 'subscriptions', icon: 'Tv', color: 'purple' },
            { key: 'software', icon: 'Code', color: 'indigo' },
        ],
    },

    shopping: {
        icon: 'ShoppingBag',
        color: 'crimson',
        subcategories: [
            { key: 'clothing', icon: 'Shirt', color: 'crimson' },
            { key: 'electronics', icon: 'Laptop', color: 'blue' },
            { key: 'home_goods', icon: 'Package', color: 'teal' },
            { key: 'personal_items', icon: 'Backpack', color: 'brown' },
            { key: 'gifts', icon: 'Gift', color: 'pink' },
        ],
    },

    lifestyle: {
        icon: 'PartyPopper',
        color: 'purple',
        subcategories: [
            { key: 'cinema', icon: 'Film', color: 'purple' },
            { key: 'events', icon: 'CalendarDays', color: 'orange' },
            { key: 'concerts', icon: 'Music', color: 'red' },
            { key: 'games', icon: 'Gamepad2', color: 'indigo' },
            { key: 'nightlife', icon: 'Wine', color: 'violet' },
        ],
    },

    personal_care: {
        icon: 'Sparkles',
        color: 'pink',
        subcategories: [
            { key: 'haircut', icon: 'Scissors', color: 'amber' },
            { key: 'spa', icon: 'Flower', color: 'teal' },
            { key: 'massage', icon: 'HandHeart', color: 'green' },
            { key: 'beauty_services', icon: 'Sparkles', color: 'pink' },
            { key: 'hygiene', icon: 'Droplets', color: 'sky' },
            { key: 'skincare', icon: 'FlaskConical', color: 'mint' },
            { key: 'cosmetics', icon: 'Paintbrush', color: 'crimson' },
        ],
    },

    sports: {
        icon: 'Dumbbell',
        color: 'green',
        subcategories: [
            { key: 'subscription', icon: 'Dumbbell', color: 'green' },
            { key: 'coach', icon: 'PersonStanding', color: 'blue' },
            { key: 'equipment', icon: 'ShoppingBag', color: 'orange' },
        ],
    },

    health: {
        icon: 'HeartPulse',
        color: 'red',
        subcategories: [
            { key: 'medical', icon: 'Stethoscope', color: 'red' },
            { key: 'pharmacy', icon: 'Pill', color: 'green' },
            { key: 'dental', icon: 'SmilePlus', color: 'sky' },
            { key: 'health_insurance', icon: 'ShieldPlus', color: 'blue' },
        ],
    },

    travel: {
        icon: 'Plane',
        color: 'sky',
        subcategories: [
            { key: 'flights', icon: 'Plane', color: 'sky' },
            { key: 'accommodation', icon: 'Hotel', color: 'amber' },
            { key: 'activities', icon: 'MapPin', color: 'green' },
            { key: 'visa', icon: 'FileText', color: 'indigo' },
            { key: 'insurance', icon: 'ShieldCheck', color: 'blue' },
        ],
    },

    education: {
        icon: 'GraduationCap',
        color: 'indigo',
        subcategories: [
            { key: 'online_courses', icon: 'GraduationCap', color: 'indigo' },
            { key: 'books', icon: 'BookOpen', color: 'amber' },
            { key: 'tutoring', icon: 'Users', color: 'green' },
            { key: 'certification', icon: 'Award', color: 'gold' },
        ],
    },

    finance: {
        icon: 'CreditCard',
        color: 'gold',
        subcategories: [
            { key: 'fees', icon: 'Landmark', color: 'gray' },
            { key: 'taxes', icon: 'Receipt', color: 'red' },
            { key: 'loans', icon: 'TrendingDown', color: 'orange' },
            { key: 'investments', icon: 'TrendingUp', color: 'green' },
            { key: 'crypto', icon: 'Bitcoin', color: 'amber' },
            { key: 'currency_exchange', icon: 'ArrowLeftRight', color: 'blue' },
            { key: 'cash_withdrawal', icon: 'Banknote', color: 'gold' },
            { key: 'transfers', icon: 'RefreshCw', color: 'violet' },
        ],
    },

    pets: {
        icon: 'PawPrint',
        color: 'brown',
        subcategories: [
            { key: 'pet_food', icon: 'PawPrint', color: 'amber' },
            { key: 'vet', icon: 'HeartPulse', color: 'red' },
            { key: 'pet_items', icon: 'ShoppingBag', color: 'teal' },
        ],
    },

    other: {
        icon: 'MoreHorizontal',
        color: 'gray',
        subcategories: [],
    },
} as const;

export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;
export const DEFAULT_EXPENSE_CATEGORY: ExpenseCategory = 'other';

export type ExpenseSubcategory<T extends ExpenseCategory = ExpenseCategory> =
    (typeof EXPENSE_CATEGORIES)[T]['subcategories'][number]['key'];
