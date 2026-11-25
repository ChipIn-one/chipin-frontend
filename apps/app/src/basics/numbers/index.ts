import { Amount as AmountComp, amountSelectors } from './amount';
import { constructNumberComponent } from './NumberConstructor';

export const Amount = constructNumberComponent(AmountComp);

export { amountSelectors };
