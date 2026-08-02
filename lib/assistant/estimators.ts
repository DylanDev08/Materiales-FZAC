import "server-only";

import type { AssistantAction, AssistantState } from "@/lib/assistant/contracts";
import { mergeAssistantFacts } from "@/lib/assistant/conversation-state";

type EstimateGuidance = {
  message: string;
  stage: string;
  gathered: Record<string, string>;
  actions: AssistantAction[];
};

function numberFrom(facts: Record<string, string>, key: string, fallback: number) {
  const value = Number(facts[key]);
  return Number.isFinite(value) ? value : fallback;
}

function displayNumber(value: number, decimals = 1) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: decimals }).format(value);
}

function askForProject(gathered: Record<string, string>): EstimateGuidance {
  return {
    message: "¿Qué trabajo querés calcular? Elegí pintura, placas de construcción en seco o cemento/contrapiso. Voy a pedirte solo las medidas necesarias.",
    stage: "AWAITING_PROJECT",
    gathered,
    actions: [
      { label: "Calcular pintura", message: "Quiero calcular pintura" },
      { label: "Calcular placas", message: "Quiero calcular placas de durlock" },
      { label: "Calcular cemento", message: "Quiero calcular cemento para contrapiso" },
      { label: "Ver productos", href: "/productos" }
    ]
  };
}

function askForArea(gathered: Record<string, string>): EstimateGuidance {
  const project = gathered.project;
  const label = project === "PAINT" ? "pintar" : project === "DRYWALL" ? "cubrir con placas" : "construir";
  return {
    message: `Necesito la superficie para ${label}. Podés escribir, por ejemplo, “40 m2” o “pared de 3 x 4 metros”.`,
    stage: "AWAITING_AREA",
    gathered,
    actions: [
      { label: "Ingresar 20 m2", message: "La superficie es de 20 m2" },
      { label: "Ingresar 40 m2", message: "La superficie es de 40 m2" },
      { label: "Cambiar cálculo", message: "Quiero calcular otro material" },
      { label: "Ver catálogo", href: "/productos" }
    ]
  };
}

function paintEstimate(gathered: Record<string, string>): EstimateGuidance {
  const area = numberFrom(gathered, "areaM2", 0);
  const coats = numberFrom(gathered, "coats", 2);
  const waste = numberFrom(gathered, "wastePercent", 10);
  const multiplier = 1 + waste / 100;
  const minimumLiters = (area * coats * multiplier) / 12;
  const maximumLiters = (area * coats * multiplier) / 8;
  return {
    message: `Para ${displayNumber(area)} m2 y ${coats} manos, calculá aproximadamente entre ${displayNumber(minimumLiters)} y ${displayNumber(maximumLiters)} litros, incluyendo ${waste}% de margen. Es un rango inicial: confirmá el rendimiento del envase, la absorción y la preparación de la superficie antes de comprar.`,
    stage: "ESTIMATE_READY",
    gathered: { ...gathered, coats: String(coats), wastePercent: String(waste) },
    actions: [
      { label: "Ver pinturas", href: "/productos?search=pintura" },
      { label: "Cambiar superficie", message: "Quiero recalcular pintura con otra superficie" },
      { label: "Usar otra cantidad de manos", message: "Quiero cambiar la cantidad de manos" },
      { label: "Calcular placas", message: "Quiero calcular placas de durlock" }
    ]
  };
}

function drywallEstimate(gathered: Record<string, string>): EstimateGuidance {
  const area = numberFrom(gathered, "areaM2", 0);
  const waste = numberFrom(gathered, "wastePercent", 10);
  const standardBoardArea = 1.2 * 2.4;
  const boards = Math.ceil((area * (1 + waste / 100)) / standardBoardArea);
  return {
    message: `Para cubrir ${displayNumber(area)} m2, una referencia inicial es ${boards} placas estándar de 1,20 x 2,40 m, incluyendo ${waste}% de margen. Verificá el formato real, aberturas y modulación; perfiles, tornillos, cinta y masilla se calculan por separado.`,
    stage: "ESTIMATE_READY",
    gathered: { ...gathered, wastePercent: String(waste), boardFormat: "1.20x2.40" },
    actions: [
      { label: "Ver placas", href: "/productos?search=placa" },
      { label: "Calcular otra pared", message: "Quiero calcular placas para otra medida" },
      { label: "Consultar complementos", message: "Qué perfiles y complementos necesito" },
      { label: "Calcular pintura", message: "Quiero calcular pintura" }
    ]
  };
}

function masonryEstimate(gathered: Record<string, string>): EstimateGuidance {
  const area = numberFrom(gathered, "areaM2", 0);
  const thickness = numberFrom(gathered, "thicknessM", 0);
  if (!thickness) {
    return {
      message: `Ya tengo la superficie de ${displayNumber(area)} m2. Ahora necesito el espesor y el uso, por ejemplo “contrapiso de 5 cm de espesor”. Sin dosificación no voy a inventar una cantidad de bolsas.`,
      stage: "AWAITING_THICKNESS",
      gathered,
      actions: [
        { label: "Espesor 3 cm", message: "Es un contrapiso de 3 cm de espesor" },
        { label: "Espesor 5 cm", message: "Es un contrapiso de 5 cm de espesor" },
        { label: "Cambiar superficie", message: "Quiero cambiar la superficie" },
        { label: "Ver cementos", href: "/productos?search=cemento" }
      ]
    };
  }

  const waste = numberFrom(gathered, "wastePercent", 10);
  const volume = area * thickness * (1 + waste / 100);
  return {
    message: `Para ${displayNumber(area)} m2 con ${displayNumber(thickness * 100)} cm de espesor, el volumen de referencia es ${displayNumber(volume, 2)} m3 incluyendo ${waste}% de margen. La cantidad de cemento, arena o piedra depende de la mezcla y especificación técnica; confirmá la dosificación antes de comprar.`,
    stage: "ESTIMATE_READY",
    gathered: { ...gathered, wastePercent: String(waste) },
    actions: [
      { label: "Ver cementos", href: "/productos?search=cemento" },
      { label: "Cambiar espesor", message: "Quiero recalcular con otro espesor" },
      { label: "Consultar dosificación", message: "Necesito orientación sobre la mezcla" },
      { label: "Calcular otro material", message: "Quiero calcular otro material" }
    ]
  };
}

export function createEstimateGuidance(message: string, previous: AssistantState | null): EstimateGuidance {
  const gathered = mergeAssistantFacts(previous, message, "estimate");
  if (!gathered.project) return askForProject(gathered);
  if (!gathered.areaM2) return askForArea(gathered);
  if (gathered.project === "PAINT") return paintEstimate(gathered);
  if (gathered.project === "DRYWALL") return drywallEstimate(gathered);
  return masonryEstimate(gathered);
}
