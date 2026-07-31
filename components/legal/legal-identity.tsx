import { getStoreLegalIdentity } from "@/lib/legal/store-identity";

export function LegalIdentity({ showHours = true }: { showHours?: boolean }) {
  const identity = getStoreLegalIdentity();

  return (
    <dl className="legal-identity">
      <div>
        <dt>Proveedor</dt>
        <dd>{identity.legalName || identity.commercialName}</dd>
      </div>
      {identity.legalName ? (
        <div>
          <dt>Nombre comercial</dt>
          <dd>{identity.commercialName}</dd>
        </div>
      ) : null}
      {identity.taxId ? (
        <div>
          <dt>CUIT</dt>
          <dd>{identity.taxId}</dd>
        </div>
      ) : null}
      <div>
        <dt>Domicilio</dt>
        <dd>{identity.address}</dd>
      </div>
      <div>
        <dt>Atención al consumidor</dt>
        <dd><a href={`mailto:${identity.email}`}>{identity.email}</a> · <a href={`tel:${identity.phone.replace(/[^+\d]/g, "")}`}>{identity.phone}</a></dd>
      </div>
      {showHours && identity.customerServiceHours ? (
        <div>
          <dt>Horario de atención</dt>
          <dd>{identity.customerServiceHours}</dd>
        </div>
      ) : null}
    </dl>
  );
}
