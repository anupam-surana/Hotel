import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";
import { hotelInvoicePrefix } from "../src/lib/invoice";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEMO_HOTEL_SLUG = "digha-sea-breeze";
const DEMO_PASSWORD = "password123";

// UTC-midnight, matching the convention in src/lib/dates.ts: Postgres DATE
// columns have no timezone, so every calendar-date value in this app is
// constructed via Date.UTC to avoid drifting a day depending on server TZ.
function daysFromToday(offset: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + offset));
}

async function main() {
  // Demo credentials (password123 for every role) must never land in a real
  // deployment. VERCEL_ENV is set automatically by Vercel on every deploy
  // (including production) — refuse to run there at all.
  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run the demo seed against a production environment.");
  }

  // Idempotent: wipe any previous demo hotel (cascades to every child row)
  // so this script can be re-run freely during development.
  await prisma.hotel.deleteMany({ where: { slug: DEMO_HOTEL_SLUG } });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const hotel = await prisma.hotel.create({
    data: {
      slug: DEMO_HOTEL_SLUG,
      name: "Digha Sea Breeze Lodge",
      phone: "+91 98300 11223",
      email: "stay@dighaseabreeze.com",
      address: "New Digha Beach Road",
      city: "Digha",
      state: "West Bengal",
      pincode: "721428",
      gstin: "19ABCDE1234F1Z5",
      description: "A family-run beachfront lodge in Digha, West Bengal.",
      defaultLocale: "bn",
    },
  });

  // Grandfather the demo hotel in as an active subscriber — otherwise it'd be
  // stuck TRIALING/locked out with no way to pay via the demo credentials.
  await prisma.platformSubscription.create({
    data: {
      hotelId: hotel.id,
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.UTC(2099, 0, 1)),
    },
  });

  const [owner, manager, frontdesk, housekeeping] = await Promise.all([
    prisma.user.create({
      data: {
        hotelId: hotel.id,
        name: "Debashish Das",
        email: "owner@dighaseabreeze.com",
        passwordHash,
        role: "OWNER",
        phone: "+91 98300 00001",
        locale: "bn",
        emailVerifiedAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        hotelId: hotel.id,
        name: "Ritu Banerjee",
        email: "manager@dighaseabreeze.com",
        passwordHash,
        role: "MANAGER",
        phone: "+91 98300 00002",
        locale: "bn",
        emailVerifiedAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        hotelId: hotel.id,
        name: "Sujoy Mondal",
        email: "frontdesk@dighaseabreeze.com",
        passwordHash,
        role: "FRONTDESK",
        phone: "+91 98300 00003",
        locale: "bn",
        emailVerifiedAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        hotelId: hotel.id,
        name: "Alo Bibi",
        email: "housekeeping@dighaseabreeze.com",
        passwordHash,
        role: "HOUSEKEEPING",
        phone: "+91 98300 00004",
        locale: "bn",
        emailVerifiedAt: new Date(),
      },
    }),
  ]);

  const standardRoom = await prisma.roomType.create({
    data: {
      hotelId: hotel.id,
      name: "Standard Room",
      description: "Cosy room with two single beds, a few minutes' walk from the beach.",
      maxAdults: 2,
      maxChildren: 1,
      basePrice: 1800,
      amenities: ["Fan", "Attached bathroom", "Free Wi-Fi"],
    },
  });

  const deluxeRoom = await prisma.roomType.create({
    data: {
      hotelId: hotel.id,
      name: "Deluxe Sea View",
      description: "Air-conditioned room with a private balcony facing the sea.",
      maxAdults: 3,
      maxChildren: 1,
      basePrice: 2800,
      amenities: ["AC", "Sea view", "TV", "Free Wi-Fi"],
    },
  });

  const familySuite = await prisma.roomType.create({
    data: {
      hotelId: hotel.id,
      name: "Family Suite",
      description: "Two connected rooms, ideal for families travelling together.",
      maxAdults: 4,
      maxChildren: 2,
      basePrice: 4200,
      amenities: ["AC", "TV", "Free Wi-Fi", "Extra bed available"],
    },
  });

  const standardRooms = await Promise.all(
    ["101", "102", "103", "104", "105"].map((roomNumber) =>
      prisma.room.create({
        data: { hotelId: hotel.id, roomTypeId: standardRoom.id, roomNumber, floor: "1" },
      })
    )
  );

  const [deluxe201, deluxe202, deluxe203] = await Promise.all(
    ["201", "202", "203"].map((roomNumber) =>
      prisma.room.create({
        data: { hotelId: hotel.id, roomTypeId: deluxeRoom.id, roomNumber, floor: "2" },
      })
    )
  );

  const [suite301, suite302] = await Promise.all(
    ["301", "302"].map((roomNumber) =>
      prisma.room.create({
        data: { hotelId: hotel.id, roomTypeId: familySuite.id, roomNumber, floor: "3" },
      })
    )
  );

  const [anindita, rahul, priyanka, mohammed, sourav] = await Promise.all([
    prisma.guest.create({
      data: { hotelId: hotel.id, name: "Anindita Chatterjee", phone: "+91 98300 12345", email: "anindita.c@example.com" },
    }),
    prisma.guest.create({
      data: { hotelId: hotel.id, name: "Rahul Verma", phone: "+91 91234 56780", email: "rahul.verma@example.com" },
    }),
    prisma.guest.create({
      data: { hotelId: hotel.id, name: "Priyanka Ghosh", phone: "+91 89000 11122", idType: "AADHAAR", idNumber: "XXXX-XXXX-4521" },
    }),
    prisma.guest.create({
      data: { hotelId: hotel.id, name: "Mohammed Imran", phone: "+91 97001 22334" },
    }),
    prisma.guest.create({
      data: { hotelId: hotel.id, name: "Sourav Kar", phone: "+91 90511 22334" },
    }),
  ]);

  // 1. Arriving today, room pre-assigned but guest not yet checked in.
  await prisma.booking.create({
    data: {
      hotelId: hotel.id,
      guestId: anindita.id,
      source: "DIRECT",
      status: "CONFIRMED",
      checkIn: daysFromToday(0),
      checkOut: daysFromToday(2),
      adults: 2,
      createdById: frontdesk.id,
      totalAmount: 3600,
      bookingRooms: {
        create: {
          hotelId: hotel.id,
          roomTypeId: standardRoom.id,
          roomId: standardRooms[0].id,
          checkIn: daysFromToday(0),
          checkOut: daysFromToday(2),
          ratePerNight: 1800,
          amount: 3600,
        },
      },
    },
  });

  // 2. In house, departing today.
  await prisma.booking.create({
    data: {
      hotelId: hotel.id,
      guestId: rahul.id,
      source: "WALK_IN",
      status: "CHECKED_IN",
      checkIn: daysFromToday(-2),
      checkOut: daysFromToday(0),
      adults: 2,
      createdById: frontdesk.id,
      totalAmount: 5600,
      bookingRooms: {
        create: {
          hotelId: hotel.id,
          roomTypeId: deluxeRoom.id,
          roomId: deluxe201.id,
          checkIn: daysFromToday(-2),
          checkOut: daysFromToday(0),
          ratePerNight: 2800,
          amount: 5600,
        },
      },
      payments: {
        create: {
          hotelId: hotel.id,
          type: "PAYMENT",
          method: "CASH",
          status: "PAID",
          amount: 5600,
          paidAt: daysFromToday(-2),
          createdById: frontdesk.id,
        },
      },
    },
  });
  await prisma.room.update({ where: { id: deluxe201.id }, data: { status: "OCCUPIED" } });

  // 3. In house, mid-stay (not arriving or departing today).
  await prisma.booking.create({
    data: {
      hotelId: hotel.id,
      guestId: priyanka.id,
      source: "DIRECT",
      status: "CHECKED_IN",
      checkIn: daysFromToday(-1),
      checkOut: daysFromToday(2),
      adults: 3,
      children: 1,
      createdById: manager.id,
      totalAmount: 12600,
      bookingRooms: {
        create: {
          hotelId: hotel.id,
          roomTypeId: familySuite.id,
          roomId: suite301.id,
          checkIn: daysFromToday(-1),
          checkOut: daysFromToday(2),
          ratePerNight: 4200,
          amount: 12600,
        },
      },
      payments: {
        create: {
          hotelId: hotel.id,
          type: "PAYMENT",
          method: "UPI",
          status: "PAID",
          amount: 6000,
          paidAt: daysFromToday(-1),
          createdById: manager.id,
        },
      },
    },
  });
  await prisma.room.update({ where: { id: suite301.id }, data: { status: "OCCUPIED" } });

  // 4. Upcoming OTA booking, room not assigned yet (front desk assigns closer to arrival).
  await prisma.booking.create({
    data: {
      hotelId: hotel.id,
      guestId: mohammed.id,
      source: "BOOKING_COM",
      status: "CONFIRMED",
      checkIn: daysFromToday(5),
      checkOut: daysFromToday(7),
      adults: 2,
      totalAmount: 6000,
      bookingRooms: {
        create: {
          hotelId: hotel.id,
          roomTypeId: deluxeRoom.id,
          checkIn: daysFromToday(5),
          checkOut: daysFromToday(7),
          ratePerNight: 3000,
          amount: 6000,
        },
      },
    },
  });

  // 5. Cancelled booking.
  await prisma.booking.create({
    data: {
      hotelId: hotel.id,
      guestId: sourav.id,
      source: "DIRECT",
      status: "CANCELLED",
      checkIn: daysFromToday(3),
      checkOut: daysFromToday(4),
      adults: 1,
      totalAmount: 1800,
      cancelledAt: new Date(),
      cancellationReason: "Guest changed travel plans",
      bookingRooms: {
        create: {
          hotelId: hotel.id,
          roomTypeId: standardRoom.id,
          checkIn: daysFromToday(3),
          checkOut: daysFromToday(4),
          ratePerNight: 1800,
          amount: 1800,
        },
      },
    },
  });

  // 6. Past stay, checked out — room needs housekeeping, invoice already generated.
  // Rahul Verma stays twice, demonstrating the repeat-guest history view.
  const pastBooking = await prisma.booking.create({
    data: {
      hotelId: hotel.id,
      guestId: rahul.id,
      source: "MMT",
      status: "CHECKED_OUT",
      checkIn: daysFromToday(-5),
      checkOut: daysFromToday(-3),
      adults: 2,
      totalAmount: 5600,
      bookingRooms: {
        create: {
          hotelId: hotel.id,
          roomTypeId: deluxeRoom.id,
          roomId: deluxe202.id,
          checkIn: daysFromToday(-5),
          checkOut: daysFromToday(-3),
          ratePerNight: 2800,
          amount: 5600,
        },
      },
      payments: {
        create: {
          hotelId: hotel.id,
          type: "PAYMENT",
          method: "CASH",
          status: "PAID",
          amount: 5600,
          paidAt: daysFromToday(-5),
        },
      },
    },
  });
  await prisma.room.update({ where: { id: deluxe202.id }, data: { status: "DIRTY" } });

  // Room tariff is <= 7500/night, so GST is 12% (6% CGST + 6% SGST) per current slab rules.
  const taxableAmount = 5600;
  const cgstAmount = 336; // 6%
  const sgstAmount = 336; // 6%
  await prisma.invoice.create({
    data: {
      hotelId: hotel.id,
      bookingId: pastBooking.id,
      invoiceNumber: `${hotelInvoicePrefix(hotel.name)}/${new Date().getUTCFullYear()}/0001`,
      guestName: "Rahul Verma",
      placeOfSupply: "West Bengal",
      taxableAmount,
      cgstRate: 6,
      cgstAmount,
      sgstRate: 6,
      sgstAmount,
      totalAmount: taxableAmount + cgstAmount + sgstAmount,
    },
  });

  await prisma.housekeepingTask.create({
    data: {
      hotelId: hotel.id,
      roomId: deluxe202.id,
      assignedToId: housekeeping.id,
      status: "PENDING",
      notes: "Checked out this morning, needs a full clean before next guest.",
      dueDate: daysFromToday(0),
    },
  });

  // Seasonal pricing example: weekend surge on the Deluxe room, and a stop-sell
  // example on the Family Suite (e.g. reserved for maintenance).
  await prisma.rateAvailability.createMany({
    data: [
      {
        hotelId: hotel.id,
        roomTypeId: deluxeRoom.id,
        date: daysFromToday(5),
        price: 3500,
      },
      {
        hotelId: hotel.id,
        roomTypeId: familySuite.id,
        date: daysFromToday(10),
        closedOut: true,
      },
    ],
  });

  // OTA iCal connection scaffolded but not yet configured by the owner
  // (they paste the Booking.com extranet iCal URL in from Settings).
  await prisma.channelConnection.create({
    data: {
      hotelId: hotel.id,
      roomTypeId: deluxeRoom.id,
      channel: "BOOKING_COM",
    },
  });

  console.log("Seeded demo hotel:", hotel.name);
  console.log("Login at /login with any of:");
  for (const u of [owner, manager, frontdesk, housekeeping]) {
    console.log(`  ${u.role.padEnd(12)} ${u.email}  (password: ${DEMO_PASSWORD})`);
  }
  console.log("Unassigned room in Standard Room and Family Suite left free for testing front-desk assignment:", suite302.roomNumber, standardRooms[1].roomNumber, standardRooms[2].roomNumber, standardRooms[3].roomNumber, standardRooms[4].roomNumber, deluxe203.roomNumber);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
