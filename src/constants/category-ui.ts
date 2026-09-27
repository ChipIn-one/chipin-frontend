import type { LucideIcon } from 'lucide-react';
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

import { EXPENSE_CATEGORIES, type ExpenseCategory } from './category';

type ExpenseCategoryUiConfig = {
    [Category in ExpenseCategory]: {
        icon: LucideIcon;
        color: string;
        subcategories: {
            [Subcategory in (typeof EXPENSE_CATEGORIES)[Category]['subcategories'][number]]: {
                icon: LucideIcon;
                color: string;
            };
        };
    };
};

export const EXPENSE_CATEGORY_UI = {
    food: {
        icon: LucideUtensils,
        color: 'orange',
        subcategories: {
            groceries: { icon: LucideShoppingCart, color: 'green' },
            restaurants: { icon: LucideUtensilsCrossed, color: 'orange' },
            fast_food: { icon: LucideSandwich, color: 'red' },
            coffee: { icon: LucideCoffee, color: 'brown' },
            food_delivery: { icon: LucideBike, color: 'amber' },
        },
    },

    transport: {
        icon: LucideCar,
        color: 'blue',
        subcategories: {
            public_transport: { icon: LucideBus, color: 'blue' },
            taxi: { icon: LucideCarTaxiFront, color: 'amber' },
            fuel: { icon: LucideFuel, color: 'orange' },
            vehicle_rent: { icon: LucideCarFront, color: 'sky' },
            parking: { icon: LucideParkingSquare, color: 'gray' },
            vehicle_repair: { icon: LucideWrench, color: 'brown' },
            vehicle_insurance: { icon: LucideShield, color: 'indigo' },
            tolls: { icon: LucideRoute, color: 'teal' },
        },
    },

    housing: {
        icon: LucideHome,
        color: 'amber',
        subcategories: {
            rent: { icon: LucideHome, color: 'amber' },
            mortgage: { icon: LucideBuilding2, color: 'brown' },
            utilities: { icon: LucideZap, color: 'yellow' },
            home_maintenance: { icon: LucideHammer, color: 'orange' },
            furnishing: { icon: LucideSofa, color: 'teal' },
        },
    },

    digital: {
        icon: LucideWifi,
        color: 'violet',
        subcategories: {
            internet: { icon: LucideGlobe, color: 'sky' },
            mobile: { icon: LucideSmartphone, color: 'violet' },
            subscriptions: { icon: LucideTv, color: 'purple' },
            software: { icon: LucideCode, color: 'indigo' },
        },
    },

    shopping: {
        icon: LucideShoppingBag,
        color: 'crimson',
        subcategories: {
            clothing: { icon: LucideShirt, color: 'crimson' },
            electronics: { icon: LucideLaptop, color: 'blue' },
            home_goods: { icon: LucidePackage, color: 'teal' },
            personal_items: { icon: LucideBackpack, color: 'brown' },
            gifts: { icon: LucideGift, color: 'pink' },
        },
    },

    lifestyle: {
        icon: LucidePartyPopper,
        color: 'purple',
        subcategories: {
            cinema: { icon: LucideFilm, color: 'purple' },
            events: { icon: LucideCalendarDays, color: 'orange' },
            concerts: { icon: LucideMusic, color: 'red' },
            games: { icon: LucideGamepad2, color: 'indigo' },
            nightlife: { icon: LucideWine, color: 'violet' },
        },
    },

    personal_care: {
        icon: LucideSparkles,
        color: 'pink',
        subcategories: {
            haircut: { icon: LucideScissors, color: 'amber' },
            spa: { icon: LucideFlower, color: 'teal' },
            massage: { icon: LucideHandHeart, color: 'green' },
            beauty_services: { icon: LucideSparkles, color: 'pink' },
            hygiene: { icon: LucideDroplets, color: 'sky' },
            skincare: { icon: LucideFlaskConical, color: 'mint' },
            cosmetics: { icon: LucidePaintbrush, color: 'crimson' },
        },
    },

    sports: {
        icon: LucideDumbbell,
        color: 'green',
        subcategories: {
            subscription: { icon: LucideDumbbell, color: 'green' },
            coach: { icon: LucidePersonStanding, color: 'blue' },
            equipment: { icon: LucideShoppingBag, color: 'orange' },
        },
    },

    health: {
        icon: LucideHeartPulse,
        color: 'red',
        subcategories: {
            medical: { icon: LucideStethoscope, color: 'red' },
            pharmacy: { icon: LucidePill, color: 'green' },
            dental: { icon: LucideSmilePlus, color: 'sky' },
            health_insurance: { icon: LucideShieldPlus, color: 'blue' },
        },
    },

    travel: {
        icon: LucidePlane,
        color: 'sky',
        subcategories: {
            flights: { icon: LucidePlane, color: 'sky' },
            accommodation: { icon: LucideHotel, color: 'amber' },
            activities: { icon: LucideMapPin, color: 'green' },
            visa: { icon: LucideFileText, color: 'indigo' },
            insurance: { icon: LucideShieldCheck, color: 'blue' },
        },
    },

    education: {
        icon: LucideGraduationCap,
        color: 'indigo',
        subcategories: {
            online_courses: { icon: LucideGraduationCap, color: 'indigo' },
            books: { icon: LucideBookOpen, color: 'amber' },
            tutoring: { icon: LucideUsers, color: 'green' },
            certification: { icon: LucideAward, color: 'gold' },
        },
    },

    finance: {
        icon: LucideCreditCard,
        color: 'gold',
        subcategories: {
            fees: { icon: LucideLandmark, color: 'gray' },
            taxes: { icon: LucideReceipt, color: 'red' },
            loans: { icon: LucideTrendingDown, color: 'orange' },
            investments: { icon: LucideTrendingUp, color: 'green' },
            crypto: { icon: LucideBitcoin, color: 'amber' },
            currency_exchange: { icon: LucideArrowLeftRight, color: 'blue' },
            cash_withdrawal: { icon: LucideBanknote, color: 'gold' },
            transfers: { icon: LucideRefreshCw, color: 'violet' },
        },
    },

    pets: {
        icon: LucidePawPrint,
        color: 'brown',
        subcategories: {
            pet_food: { icon: LucidePawPrint, color: 'amber' },
            vet: { icon: LucideHeartPulse, color: 'red' },
            pet_items: { icon: LucideShoppingBag, color: 'teal' },
        },
    },

    other: {
        icon: LucideMoreHorizontal,
        color: 'gray',
        subcategories: {},
    },
} satisfies ExpenseCategoryUiConfig;
