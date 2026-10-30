import type { LucideIcon } from 'lucide-react';
import {
    ArrowLeftRightIcon,
    AwardIcon,
    BackpackIcon,
    BanknoteIcon,
    BikeIcon,
    BitcoinIcon,
    BookOpenIcon,
    Building2Icon,
    BusIcon,
    CalendarDaysIcon,
    CarFrontIcon,
    CarIcon,
    CarTaxiFrontIcon,
    CodeIcon,
    CoffeeIcon,
    CreditCardIcon,
    DropletsIcon,
    DumbbellIcon,
    FileTextIcon,
    FilmIcon,
    FlaskConicalIcon,
    FlowerIcon,
    FuelIcon,
    Gamepad2Icon,
    GiftIcon,
    GlobeIcon,
    GraduationCapIcon,
    HammerIcon,
    HandHeartIcon,
    HeartPulseIcon,
    HomeIcon,
    HotelIcon,
    LandmarkIcon,
    LaptopIcon,
    MapPinIcon,
    MoreHorizontalIcon,
    MusicIcon,
    PackageIcon,
    PaintbrushIcon,
    ParkingSquareIcon,
    PartyPopperIcon,
    PawPrintIcon,
    PersonStandingIcon,
    PillIcon,
    PlaneIcon,
    ReceiptIcon,
    RefreshCwIcon,
    RouteIcon,
    SandwichIcon,
    ScissorsIcon,
    ShieldCheckIcon,
    ShieldIcon,
    ShieldPlusIcon,
    ShirtIcon,
    ShoppingBagIcon,
    ShoppingCartIcon,
    SmartphoneIcon,
    SmilePlusIcon,
    SofaIcon,
    SparklesIcon,
    StethoscopeIcon,
    TrendingDownIcon,
    TrendingUpIcon,
    TvIcon,
    UsersIcon,
    UtensilsCrossedIcon,
    UtensilsIcon,
    WifiIcon,
    WineIcon,
    WrenchIcon,
    ZapIcon,
} from 'lucide-react';
import type { ComponentProps } from 'react';

import { Avatar } from '@radix-ui/themes';

import { EXPENSE_CATEGORIES, type ExpenseCategory } from './category';

type ExpenseCategoryUiColor = NonNullable<ComponentProps<typeof Avatar>['color']>;

type ExpenseCategoryUiConfig = {
    [Category in ExpenseCategory]: {
        icon: LucideIcon;
        color: ExpenseCategoryUiColor;
        subcategories: {
            [Subcategory in (typeof EXPENSE_CATEGORIES)[Category]['subcategories'][number]]: {
                icon: LucideIcon;
                color: ExpenseCategoryUiColor;
            };
        };
    };
};

export const EXPENSE_CATEGORY_UI = {
    food: {
        icon: UtensilsIcon,
        color: 'orange',
        subcategories: {
            groceries: { icon: ShoppingCartIcon, color: 'green' },
            restaurants: { icon: UtensilsCrossedIcon, color: 'orange' },
            fast_food: { icon: SandwichIcon, color: 'red' },
            coffee: { icon: CoffeeIcon, color: 'brown' },
            food_delivery: { icon: BikeIcon, color: 'amber' },
        },
    },

    transport: {
        icon: CarIcon,
        color: 'blue',
        subcategories: {
            public_transport: { icon: BusIcon, color: 'blue' },
            taxi: { icon: CarTaxiFrontIcon, color: 'amber' },
            fuel: { icon: FuelIcon, color: 'orange' },
            vehicle_rent: { icon: CarFrontIcon, color: 'sky' },
            parking: { icon: ParkingSquareIcon, color: 'gray' },
            vehicle_repair: { icon: WrenchIcon, color: 'brown' },
            vehicle_insurance: { icon: ShieldIcon, color: 'indigo' },
            tolls: { icon: RouteIcon, color: 'teal' },
        },
    },

    housing: {
        icon: HomeIcon,
        color: 'amber',
        subcategories: {
            rent: { icon: HomeIcon, color: 'amber' },
            mortgage: { icon: Building2Icon, color: 'brown' },
            utilities: { icon: ZapIcon, color: 'yellow' },
            home_maintenance: { icon: HammerIcon, color: 'orange' },
            furnishing: { icon: SofaIcon, color: 'teal' },
        },
    },

    digital: {
        icon: WifiIcon,
        color: 'violet',
        subcategories: {
            internet: { icon: GlobeIcon, color: 'sky' },
            mobile: { icon: SmartphoneIcon, color: 'violet' },
            subscriptions: { icon: TvIcon, color: 'purple' },
            software: { icon: CodeIcon, color: 'indigo' },
        },
    },

    shopping: {
        icon: ShoppingBagIcon,
        color: 'crimson',
        subcategories: {
            clothing: { icon: ShirtIcon, color: 'crimson' },
            electronics: { icon: LaptopIcon, color: 'blue' },
            home_goods: { icon: PackageIcon, color: 'teal' },
            personal_items: { icon: BackpackIcon, color: 'brown' },
            gifts: { icon: GiftIcon, color: 'pink' },
        },
    },

    lifestyle: {
        icon: PartyPopperIcon,
        color: 'purple',
        subcategories: {
            cinema: { icon: FilmIcon, color: 'purple' },
            events: { icon: CalendarDaysIcon, color: 'orange' },
            concerts: { icon: MusicIcon, color: 'red' },
            games: { icon: Gamepad2Icon, color: 'indigo' },
            nightlife: { icon: WineIcon, color: 'violet' },
        },
    },

    personal_care: {
        icon: SparklesIcon,
        color: 'pink',
        subcategories: {
            haircut: { icon: ScissorsIcon, color: 'amber' },
            spa: { icon: FlowerIcon, color: 'teal' },
            massage: { icon: HandHeartIcon, color: 'green' },
            beauty_services: { icon: SparklesIcon, color: 'pink' },
            hygiene: { icon: DropletsIcon, color: 'sky' },
            skincare: { icon: FlaskConicalIcon, color: 'mint' },
            cosmetics: { icon: PaintbrushIcon, color: 'crimson' },
        },
    },

    sports: {
        icon: DumbbellIcon,
        color: 'green',
        subcategories: {
            subscription: { icon: DumbbellIcon, color: 'green' },
            coach: { icon: PersonStandingIcon, color: 'blue' },
            equipment: { icon: ShoppingBagIcon, color: 'orange' },
        },
    },

    health: {
        icon: HeartPulseIcon,
        color: 'red',
        subcategories: {
            medical: { icon: StethoscopeIcon, color: 'red' },
            pharmacy: { icon: PillIcon, color: 'green' },
            dental: { icon: SmilePlusIcon, color: 'sky' },
            health_insurance: { icon: ShieldPlusIcon, color: 'blue' },
        },
    },

    travel: {
        icon: PlaneIcon,
        color: 'sky',
        subcategories: {
            flights: { icon: PlaneIcon, color: 'sky' },
            accommodation: { icon: HotelIcon, color: 'amber' },
            activities: { icon: MapPinIcon, color: 'green' },
            visa: { icon: FileTextIcon, color: 'indigo' },
            insurance: { icon: ShieldCheckIcon, color: 'blue' },
        },
    },

    education: {
        icon: GraduationCapIcon,
        color: 'indigo',
        subcategories: {
            online_courses: { icon: GraduationCapIcon, color: 'indigo' },
            books: { icon: BookOpenIcon, color: 'amber' },
            tutoring: { icon: UsersIcon, color: 'green' },
            certification: { icon: AwardIcon, color: 'gold' },
        },
    },

    finance: {
        icon: CreditCardIcon,
        color: 'gold',
        subcategories: {
            fees: { icon: LandmarkIcon, color: 'gray' },
            taxes: { icon: ReceiptIcon, color: 'red' },
            loans: { icon: TrendingDownIcon, color: 'orange' },
            investments: { icon: TrendingUpIcon, color: 'green' },
            crypto: { icon: BitcoinIcon, color: 'amber' },
            currency_exchange: { icon: ArrowLeftRightIcon, color: 'blue' },
            cash_withdrawal: { icon: BanknoteIcon, color: 'gold' },
            transfers: { icon: RefreshCwIcon, color: 'violet' },
        },
    },

    pets: {
        icon: PawPrintIcon,
        color: 'brown',
        subcategories: {
            pet_food: { icon: PawPrintIcon, color: 'amber' },
            vet: { icon: HeartPulseIcon, color: 'red' },
            pet_items: { icon: ShoppingBagIcon, color: 'teal' },
        },
    },

    other: {
        icon: MoreHorizontalIcon,
        color: 'gray',
        subcategories: {},
    },
} satisfies ExpenseCategoryUiConfig;
