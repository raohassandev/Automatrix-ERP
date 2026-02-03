import xlsx from "xlsx";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const filePath = "data/Refrens/quotation.csv";

function clean(value) {
  if (value == null) return "";
  return String(value).replace(/\t/g, " ").replace(/\s+/g, " ").trim();
}

function parseNumber(value) {
  const cleaned = clean(value);
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
}

function parseDate(value) {
  const cleaned = clean(value);
  if (!cleaned) return null;
  const parts = cleaned.split(/[-/]/).map((p) => p.trim());
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map((p) => Number(p));
  if (!day || !month || !year) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildAddress(parts) {
  const cleaned = parts.map(clean).filter(Boolean);
  return cleaned.length ? cleaned.join(", ") : "";
}

function pickIndex(headers, name, startAt = 0) {
  for (let i = startAt; i < headers.length; i += 1) {
    if (headers[i] === name) return i;
  }
  return -1;
}

async function main() {
  const workbook = xlsx.readFile(filePath, { raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (rows.length < 2) {
    console.log("No rows to import.");
    return;
  }

  const headers = rows[0].map((value) => clean(value).replace(/^"|"$/g, ""));
  const col = (name) => pickIndex(headers, name);

  const invoiceNumberIdx = col("invoiceNumber");
  const invoiceSeriesIdx = col("invoiceNumberSeries");
  const voucherNumberIdx = col("voucherNumber");
  const voucherDateIdx = col("voucherDate");
  const dueDateIdx = col("dueDate");
  const subTitleIdx = col("subTitle");
  const voucherTitleIdx = col("voucherTitle");
  const currencyIdx = col("currency");
  const clientNameIdx = col("clientName");
  const clientEmailIdx = col("clientEmail");
  const clientPhoneIdx = col("clientPhone");
  const clientStreetIdx = col("clientStreet");
  const clientCityIdx = col("clientCity");
  const clientStateIdx = col("clientState");
  const clientCountryIdx = col("clientCountry");
  const clientPincodeIdx = col("clientPincode");
  const businessNameIdx = col("businessName");
  const placeOfSupplyIdx = col("placeOfSupply");
  const notesIdx = col("notes");
  const statusIdx = col("status");
  const termsIdx = col("terms");
  const paymentMethodIdx = col("paymentMethod");
  const paidAmountIdx = col("paidAmount");
  const dueAmountIdx = col("dueAmount");
  const totalAmountIdx = col("totalAmount");
  const totalTaxIdx = col("totalTax");
  const projectIdx = col("headerCustomFields.Project");
  const projectIdx2 = col("headerCustomFields.Project ");
  const projectNameIdx = col("headerCustomFields.Project Name ");
  const projectsIdx = col("headerCustomFields.Projects");
  const salesEngineerIdx = col("headerCustomFields.Sales Engineer");

  const itemsUnitIdx = col("items.Unit");
  const itemsModelIdx = col("items.Model");
  const itemsSpecsIdx = col("items.Specifications");
  const itemsMakeIdx = col("items.Make");
  const itemsUomIdx = col("items.UoM");

  const lineItemIdx = col("lineItem");
  const descriptionIdx = col("description");
  const unitIdx = col("unit");
  const quantityIdx = col("quantity");
  const rateIdx = col("rate");
  const amountIdx = col("amount");
  const gstRateIdx = col("gstRate");
  const taxCategoryIdx = col("taxCategory");
  const taxCategoryReasonIdx = col("taxCategoryReason");
  const hsnIdx = col("hsn");
  const skuIdx = col("sku");
  const discountTypeIdx = col("discountType");
  const itemLevelPercentIdx = col("itemLevelPercent");
  const itemLevelAmountIdx = col("itemLevelAmount");

  const grouped = new Map();

  for (const row of rows.slice(1)) {
    const quoteNumber = clean(row[invoiceNumberIdx]) || clean(row[voucherNumberIdx]);
    if (!quoteNumber) continue;
    if (!grouped.has(quoteNumber)) grouped.set(quoteNumber, []);
    grouped.get(quoteNumber).push(row);
  }

  let created = 0;
  let updated = 0;
  let lineItems = 0;

  for (const [quoteNumber, quoteRows] of grouped.entries()) {
    const row = quoteRows[0];
    const clientName = clean(row[clientNameIdx]);
    const clientAddress = buildAddress([
      clientStreetIdx !== -1 ? row[clientStreetIdx] : "",
      clientCityIdx !== -1 ? row[clientCityIdx] : "",
      clientStateIdx !== -1 ? row[clientStateIdx] : "",
      clientCountryIdx !== -1 ? row[clientCountryIdx] : "",
      clientPincodeIdx !== -1 ? row[clientPincodeIdx] : "",
    ]);

    const projectRef =
      clean(row[projectIdx]) ||
      clean(row[projectIdx2]) ||
      clean(row[projectNameIdx]) ||
      clean(row[projectsIdx]) ||
      "";
    const salesEngineer = clean(row[salesEngineerIdx]);

    let clientId = null;
    if (clientName) {
      const existingClient = await prisma.client.findUnique({ where: { name: clientName } });
      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const createdClient = await prisma.client.create({
          data: {
            name: clientName,
            address: clientAddress || undefined,
          },
        });
        clientId = createdClient.id;
      }
    }

    const existing = await prisma.quotation.findUnique({ where: { quoteNumber } });

    const quotation = await prisma.quotation.upsert({
      where: { quoteNumber },
      update: {
        quoteSeries: clean(row[invoiceSeriesIdx]) || undefined,
        voucherNumber: clean(row[voucherNumberIdx]) || undefined,
        voucherDate: parseDate(row[voucherDateIdx]),
        dueDate: parseDate(row[dueDateIdx]),
        currency: clean(row[currencyIdx]) || undefined,
        status: clean(row[statusIdx]) || undefined,
        title: clean(row[voucherTitleIdx]) || undefined,
        subTitle: clean(row[subTitleIdx]) || undefined,
        projectRef: projectRef || undefined,
        salesEngineer: salesEngineer || undefined,
        clientId,
        clientName: clientName || undefined,
        clientEmail: clean(row[clientEmailIdx]) || undefined,
        clientPhone: clean(row[clientPhoneIdx]) || undefined,
        clientAddress: clientAddress || undefined,
        businessName: clean(row[businessNameIdx]) || undefined,
        placeOfSupply: clean(row[placeOfSupplyIdx]) || undefined,
        notes: clean(row[notesIdx]) || undefined,
        terms: clean(row[termsIdx]) || undefined,
        paymentMethod: clean(row[paymentMethodIdx]) || undefined,
        paidAmount: parseNumber(row[paidAmountIdx]),
        dueAmount: parseNumber(row[dueAmountIdx]),
        totalAmount: parseNumber(row[totalAmountIdx]),
        totalTax: parseNumber(row[totalTaxIdx]),
      },
      create: {
        quoteNumber,
        quoteSeries: clean(row[invoiceSeriesIdx]) || undefined,
        voucherNumber: clean(row[voucherNumberIdx]) || undefined,
        voucherDate: parseDate(row[voucherDateIdx]),
        dueDate: parseDate(row[dueDateIdx]),
        currency: clean(row[currencyIdx]) || undefined,
        status: clean(row[statusIdx]) || undefined,
        title: clean(row[voucherTitleIdx]) || undefined,
        subTitle: clean(row[subTitleIdx]) || undefined,
        projectRef: projectRef || undefined,
        salesEngineer: salesEngineer || undefined,
        clientId,
        clientName: clientName || undefined,
        clientEmail: clean(row[clientEmailIdx]) || undefined,
        clientPhone: clean(row[clientPhoneIdx]) || undefined,
        clientAddress: clientAddress || undefined,
        businessName: clean(row[businessNameIdx]) || undefined,
        placeOfSupply: clean(row[placeOfSupplyIdx]) || undefined,
        notes: clean(row[notesIdx]) || undefined,
        terms: clean(row[termsIdx]) || undefined,
        paymentMethod: clean(row[paymentMethodIdx]) || undefined,
        paidAmount: parseNumber(row[paidAmountIdx]),
        dueAmount: parseNumber(row[dueAmountIdx]),
        totalAmount: parseNumber(row[totalAmountIdx]),
        totalTax: parseNumber(row[totalTaxIdx]),
      },
    });

    if (existing) updated += 1;
    else created += 1;

    await prisma.quotationLineItem.deleteMany({ where: { quotationId: quotation.id } });

    const items = quoteRows.map((line) => ({
      quotationId: quotation.id,
      lineItem: clean(line[lineItemIdx]) || undefined,
      description: clean(line[descriptionIdx]) || undefined,
      unit: clean(line[unitIdx]) || undefined,
      quantity: parseNumber(line[quantityIdx]),
      rate: parseNumber(line[rateIdx]),
      amount: parseNumber(line[amountIdx]),
      taxRate: parseNumber(line[gstRateIdx]),
      taxCategory: clean(line[taxCategoryIdx]) || undefined,
      taxCategoryReason: clean(line[taxCategoryReasonIdx]) || undefined,
      totalTax: parseNumber(line[totalTaxIdx]),
      totalAmount: parseNumber(line[totalAmountIdx]),
      hsn: clean(line[hsnIdx]) || undefined,
      sku: clean(line[skuIdx]) || undefined,
      discountType: clean(line[discountTypeIdx]) || undefined,
      itemLevelPercent: parseNumber(line[itemLevelPercentIdx]),
      itemLevelAmount: parseNumber(line[itemLevelAmountIdx]),
      itemUnit: clean(line[itemsUnitIdx]) || undefined,
      itemModel: clean(line[itemsModelIdx]) || undefined,
      itemSpecs: clean(line[itemsSpecsIdx]) || undefined,
      itemMake: clean(line[itemsMakeIdx]) || undefined,
      itemUom: clean(line[itemsUomIdx]) || undefined,
    }));

    if (items.length) {
      await prisma.quotationLineItem.createMany({ data: items });
      lineItems += items.length;
    }
  }

  console.log(`Quotation import complete. Created: ${created}, Updated: ${updated}, Line items: ${lineItems}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
