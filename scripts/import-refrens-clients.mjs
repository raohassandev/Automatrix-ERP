import xlsx from "xlsx";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const filePath = "data/Refrens/Clients.csv";

function clean(value) {
  if (value == null) return "";
  return String(value).replace(/\t/g, " ").replace(/\s+/g, " ").trim();
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
  const clientNameIndex = pickIndex(headers, "Name");
  const contactNameIndex = (() => {
    const first = pickIndex(headers, "Name");
    if (first === -1) return -1;
    const second = pickIndex(headers, "Name", first + 1);
    return second;
  })();

  const phoneIndex = pickIndex(headers, "Phone");
  const emailIndex = pickIndex(headers, "Email");
  const industryIndex = pickIndex(headers, "Industry");
  const typeIndex = pickIndex(headers, "Select Clients/Prospects");
  const streetIndex = pickIndex(headers, "Street");
  const cityIndex = pickIndex(headers, "City");
  const stateIndex = pickIndex(headers, "State");
  const postalIndex = pickIndex(headers, "Postal Code");
  const countryIndex = pickIndex(headers, "Country");

  let created = 0;
  let updated = 0;
  let contactsCreated = 0;

  for (const row of rows.slice(1)) {
    const clientName = clean(row[clientNameIndex]);
    if (!clientName) continue;

    const contactName = contactNameIndex !== -1 ? clean(row[contactNameIndex]) : "";
    const phone = phoneIndex !== -1 ? clean(row[phoneIndex]) : "";
    const email = emailIndex !== -1 ? clean(row[emailIndex]) : "";
    const industry = industryIndex !== -1 ? clean(row[industryIndex]) : "";
    const clientType = typeIndex !== -1 ? clean(row[typeIndex]) : "";
    const address = buildAddress([
      streetIndex !== -1 ? row[streetIndex] : "",
      cityIndex !== -1 ? row[cityIndex] : "",
      stateIndex !== -1 ? row[stateIndex] : "",
      postalIndex !== -1 ? row[postalIndex] : "",
      countryIndex !== -1 ? row[countryIndex] : "",
    ]);

    const descriptionParts = [];
    if (industry) descriptionParts.push(industry);
    if (clientType) descriptionParts.push(clientType);
    const description = descriptionParts.join(" • ");

    const existing = await prisma.client.findUnique({ where: { name: clientName } });
    const client = await prisma.client.upsert({
      where: { name: clientName },
      update: {
        description: description || undefined,
        address: address || undefined,
      },
      create: {
        name: clientName,
        description: description || undefined,
        address: address || undefined,
      },
    });

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }

    if (contactName || phone || email) {
      const existingContact = await prisma.clientContact.findFirst({
        where: {
          clientId: client.id,
          name: contactName || clientName,
          phone: phone || undefined,
          email: email || undefined,
        },
      });

      if (!existingContact) {
        await prisma.clientContact.create({
          data: {
            clientId: client.id,
            name: contactName || clientName,
            phone: phone || undefined,
            email: email || undefined,
          },
        });
        contactsCreated += 1;
      }
    }
  }

  console.log(
    `Clients import complete. Created: ${created}, Updated: ${updated}, Contacts created: ${contactsCreated}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
