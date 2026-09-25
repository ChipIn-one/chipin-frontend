// Expense categories with subcategories
export const EXPENSE_CATEGORIES = {
    food: {
        subcategories: [
            'groceries',
            'restaurants',
            'fast_food',
            'coffee',
            'food_delivery',
        ],
    },

    transport: {
        subcategories: [
            'public_transport',
            'taxi',
            'fuel',
            'vehicle_rent',
            'parking',
            'vehicle_repair',
            'vehicle_insurance',
            'tolls',
        ],
    },

    housing: {
        subcategories: [
            'rent',
            'mortgage',
            'utilities',
            'home_maintenance',
            'furnishing',
        ],
    },

    digital: {
        subcategories: [
            'internet',
            'mobile',
            'subscriptions',
            'software',
        ],
    },

    shopping: {
        subcategories: [
            'clothing',
            'electronics',
            'home_goods',
            'personal_items',
            'gifts',
        ],
    },

    lifestyle: {
        subcategories: [
            'cinema',
            'events',
            'concerts',
            'games',
            'nightlife',
        ],
    },

    personal_care: {
        subcategories: [
            'haircut',
            'spa',
            'massage',
            'beauty_services',
            'hygiene',
            'skincare',
            'cosmetics',
        ],
    },

    sports: {
        subcategories: [
            'subscription',
            'coach',
            'equipment',
        ],
    },

    health: {
        subcategories: [
            'medical',
            'pharmacy',
            'dental',
            'health_insurance',
        ],
    },

    travel: {
        subcategories: [
            'flights',
            'accommodation',
            'activities',
            'visa',
            'insurance',
        ],
    },

    education: {
        subcategories: [
            'online_courses',
            'books',
            'tutoring',
            'certification',
        ],
    },

    finance: {
        subcategories: [
            'fees',
            'taxes',
            'loans',
            'investments',
            'crypto',
            'currency_exchange',
            'cash_withdrawal',
            'transfers',
        ],
    },

    pets: {
        subcategories: [
            'pet_food',
            'vet',
            'pet_items',
        ],
    },

    other: {
        subcategories: [],
    },
} as const;

export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

export const EXPENSE_CATEGORY_KEYS = Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[];

export const DEFAULT_EXPENSE_CATEGORY: ExpenseCategory = 'other';

export type ExpenseSubcategory<T extends ExpenseCategory = ExpenseCategory> =
    (typeof EXPENSE_CATEGORIES)[T]['subcategories'][number];
