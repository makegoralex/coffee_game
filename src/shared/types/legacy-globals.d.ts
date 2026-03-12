import type {
  CustomerArchetype as _CustomerArchetype,
  CustomerState as _CustomerState,
  Order as _Order,
  ServiceState as _ServiceState,
} from './state';

declare global {
  type CustomerState = _CustomerState;
  type CustomerArchetype = _CustomerArchetype;
  type Order = _Order;
  type ServiceState = _ServiceState;
}

export {};
