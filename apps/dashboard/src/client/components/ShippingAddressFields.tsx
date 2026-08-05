import type { ShippingAddress } from '../lib/shipping';

interface ShippingAddressFieldsProps {
  address: ShippingAddress;
  onChange: (patch: Partial<ShippingAddress>) => void;
  idPrefix?: string;
}

export function ShippingAddressFields({
  address,
  onChange,
  idPrefix = 'ship',
}: ShippingAddressFieldsProps) {
  return (
    <>
      <div className="auth-field">
        <label htmlFor={`${idPrefix}-name`}>Full name</label>
        <input
          id={`${idPrefix}-name`}
          value={address.fullName}
          onChange={(e) => onChange({ fullName: e.target.value })}
          required
          autoComplete="name"
          placeholder="Jean Dupont"
        />
      </div>
      <div className="auth-field">
        <label htmlFor={`${idPrefix}-line1`}>Street address</label>
        <input
          id={`${idPrefix}-line1`}
          value={address.line1}
          onChange={(e) => onChange({ line1: e.target.value })}
          required
          autoComplete="address-line1"
          placeholder="12 rue de Rivoli"
        />
      </div>
      <div className="auth-field">
        <label htmlFor={`${idPrefix}-line2`}>
          Apartment, suite <span className="label-optional">optional</span>
        </label>
        <input
          id={`${idPrefix}-line2`}
          value={address.line2}
          onChange={(e) => onChange({ line2: e.target.value })}
          autoComplete="address-line2"
          placeholder="Apt 4B"
        />
      </div>
      <div className="profile-form-row">
        <div className="auth-field">
          <label htmlFor={`${idPrefix}-city`}>City</label>
          <input
            id={`${idPrefix}-city`}
            value={address.city}
            onChange={(e) => onChange({ city: e.target.value })}
            required
            autoComplete="address-level2"
            placeholder="Paris"
          />
        </div>
        <div className="auth-field">
          <label htmlFor={`${idPrefix}-postal`}>Postal code</label>
          <input
            id={`${idPrefix}-postal`}
            value={address.postalCode}
            onChange={(e) => onChange({ postalCode: e.target.value })}
            required
            autoComplete="postal-code"
            placeholder="75001"
          />
        </div>
      </div>
      <div className="auth-field">
        <label htmlFor={`${idPrefix}-country`}>Country</label>
        <input
          id={`${idPrefix}-country`}
          value={address.country}
          onChange={(e) => onChange({ country: e.target.value })}
          required
          autoComplete="country-name"
          placeholder="France"
        />
      </div>
    </>
  );
}
