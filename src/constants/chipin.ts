import {
    LucideArrowLeftRight,
    LucideAward,
    LucideBackpack,
    LucideBanknote,
    LucideBike,
    LucideBitcoin,
    LucideBookOpen,
    LucideBuilding2,
    LucideBus,
    LucideCalendarDays,
    LucideCar,
    LucideCarFront,
    LucideCarTaxiFront,
    LucideCode,
    LucideCoffee,
    LucideCreditCard,
    LucideDroplets,
    LucideDumbbell,
    LucideFileText,
    LucideFilm,
    LucideFlaskConical,
    LucideFlower,
    LucideFuel,
    LucideGamepad2,
    LucideGift,
    LucideGlobe,
    LucideGraduationCap,
    LucideHammer,
    LucideHandHeart,
    LucideHeartPulse,
    LucideHome,
    LucideHotel,
    LucideLandmark,
    LucideLaptop,
    LucideMapPin,
    LucideMoreHorizontal,
    LucideMusic,
    LucidePackage,
    LucidePaintbrush,
    LucideParkingSquare,
    LucidePartyPopper,
    LucidePawPrint,
    LucidePersonStanding,
    LucidePill,
    LucidePlane,
    LucideReceipt,
    LucideRefreshCw,
    LucideRoute,
    LucideSandwich,
    LucideScissors,
    LucideShield,
    LucideShieldCheck,
    LucideShieldPlus,
    LucideShirt,
    LucideShoppingBag,
    LucideShoppingCart,
    LucideSmartphone,
    LucideSmilePlus,
    LucideSofa,
    LucideSparkles,
    LucideStethoscope,
    LucideTrendingDown,
    LucideTrendingUp,
    LucideTv,
    LucideUsers,
    LucideUtensils,
    LucideUtensilsCrossed,
    LucideWifi,
    LucideWine,
    LucideWrench,
    LucideZap,
} from 'lucide-react';

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
        icon: LucideUtensils,
        color: 'orange',
        subcategories: [
            { key: 'groceries', icon: LucideShoppingCart, color: 'green' },
            { key: 'restaurants', icon: LucideUtensilsCrossed, color: 'orange' },
            { key: 'fast_food', icon: LucideSandwich, color: 'red' },
            { key: 'coffee', icon: LucideCoffee, color: 'brown' },
            { key: 'food_delivery', icon: LucideBike, color: 'amber' },
        ],
    },

    transport: {
        icon: LucideCar,
        color: 'blue',
        subcategories: [
            { key: 'public_transport', icon: LucideBus, color: 'blue' },
            { key: 'taxi', icon: LucideCarTaxiFront, color: 'amber' },
            { key: 'fuel', icon: LucideFuel, color: 'orange' },
            { key: 'vehicle_rent', icon: LucideCarFront, color: 'sky' },
            { key: 'parking', icon: LucideParkingSquare, color: 'gray' },
            { key: 'vehicle_repair', icon: LucideWrench, color: 'brown' },
            { key: 'vehicle_insurance', icon: LucideShield, color: 'indigo' },
            { key: 'tolls', icon: LucideRoute, color: 'teal' },
        ],
    },

    housing: {
        icon: LucideHome,
        color: 'amber',
        subcategories: [
            { key: 'rent', icon: LucideHome, color: 'amber' },
            { key: 'mortgage', icon: LucideBuilding2, color: 'brown' },
            { key: 'utilities', icon: LucideZap, color: 'yellow' },
            { key: 'home_maintenance', icon: LucideHammer, color: 'orange' },
            { key: 'furnishing', icon: LucideSofa, color: 'teal' },
        ],
    },

    digital: {
        icon: LucideWifi,
        color: 'violet',
        subcategories: [
            { key: 'internet', icon: LucideGlobe, color: 'sky' },
            { key: 'mobile', icon: LucideSmartphone, color: 'violet' },
            { key: 'subscriptions', icon: LucideTv, color: 'purple' },
            { key: 'software', icon: LucideCode, color: 'indigo' },
        ],
    },

    shopping: {
        icon: LucideShoppingBag,
        color: 'crimson',
        subcategories: [
            { key: 'clothing', icon: LucideShirt, color: 'crimson' },
            { key: 'electronics', icon: LucideLaptop, color: 'blue' },
            { key: 'home_goods', icon: LucidePackage, color: 'teal' },
            { key: 'personal_items', icon: LucideBackpack, color: 'brown' },
            { key: 'gifts', icon: LucideGift, color: 'pink' },
        ],
    },

    lifestyle: {
        icon: LucidePartyPopper,
        color: 'purple',
        subcategories: [
            { key: 'cinema', icon: LucideFilm, color: 'purple' },
            { key: 'events', icon: LucideCalendarDays, color: 'orange' },
            { key: 'concerts', icon: LucideMusic, color: 'red' },
            { key: 'games', icon: LucideGamepad2, color: 'indigo' },
            { key: 'nightlife', icon: LucideWine, color: 'violet' },
        ],
    },

    personal_care: {
        icon: LucideSparkles,
        color: 'pink',
        subcategories: [
            { key: 'haircut', icon: LucideScissors, color: 'amber' },
            { key: 'spa', icon: LucideFlower, color: 'teal' },
            { key: 'massage', icon: LucideHandHeart, color: 'green' },
            { key: 'beauty_services', icon: LucideSparkles, color: 'pink' },
            { key: 'hygiene', icon: LucideDroplets, color: 'sky' },
            { key: 'skincare', icon: LucideFlaskConical, color: 'mint' },
            { key: 'cosmetics', icon: LucidePaintbrush, color: 'crimson' },
        ],
    },

    sports: {
        icon: LucideDumbbell,
        color: 'green',
        subcategories: [
            { key: 'subscription', icon: LucideDumbbell, color: 'green' },
            { key: 'coach', icon: LucidePersonStanding, color: 'blue' },
            { key: 'equipment', icon: LucideShoppingBag, color: 'orange' },
        ],
    },

    health: {
        icon: LucideHeartPulse,
        color: 'red',
        subcategories: [
            { key: 'medical', icon: LucideStethoscope, color: 'red' },
            { key: 'pharmacy', icon: LucidePill, color: 'green' },
            { key: 'dental', icon: LucideSmilePlus, color: 'sky' },
            { key: 'health_insurance', icon: LucideShieldPlus, color: 'blue' },
        ],
    },

    travel: {
        icon: LucidePlane,
        color: 'sky',
        subcategories: [
            { key: 'flights', icon: LucidePlane, color: 'sky' },
            { key: 'accommodation', icon: LucideHotel, color: 'amber' },
            { key: 'activities', icon: LucideMapPin, color: 'green' },
            { key: 'visa', icon: LucideFileText, color: 'indigo' },
            { key: 'insurance', icon: LucideShieldCheck, color: 'blue' },
        ],
    },

    education: {
        icon: LucideGraduationCap,
        color: 'indigo',
        subcategories: [
            { key: 'online_courses', icon: LucideGraduationCap, color: 'indigo' },
            { key: 'books', icon: LucideBookOpen, color: 'amber' },
            { key: 'tutoring', icon: LucideUsers, color: 'green' },
            { key: 'certification', icon: LucideAward, color: 'gold' },
        ],
    },

    finance: {
        icon: LucideCreditCard,
        color: 'gold',
        subcategories: [
            { key: 'fees', icon: LucideLandmark, color: 'gray' },
            { key: 'taxes', icon: LucideReceipt, color: 'red' },
            { key: 'loans', icon: LucideTrendingDown, color: 'orange' },
            { key: 'investments', icon: LucideTrendingUp, color: 'green' },
            { key: 'crypto', icon: LucideBitcoin, color: 'amber' },
            { key: 'currency_exchange', icon: LucideArrowLeftRight, color: 'blue' },
            { key: 'cash_withdrawal', icon: LucideBanknote, color: 'gold' },
            { key: 'transfers', icon: LucideRefreshCw, color: 'violet' },
        ],
    },

    pets: {
        icon: LucidePawPrint,
        color: 'brown',
        subcategories: [
            { key: 'pet_food', icon: LucidePawPrint, color: 'amber' },
            { key: 'vet', icon: LucideHeartPulse, color: 'red' },
            { key: 'pet_items', icon: LucideShoppingBag, color: 'teal' },
        ],
    },

    other: {
        icon: LucideMoreHorizontal,
        color: 'gray',
        subcategories: [],
    },
} as const;

export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;
export const DEFAULT_EXPENSE_CATEGORY: ExpenseCategory = 'other';

export type ExpenseSubcategory<T extends ExpenseCategory = ExpenseCategory> =
    (typeof EXPENSE_CATEGORIES)[T]['subcategories'][number]['key'];
