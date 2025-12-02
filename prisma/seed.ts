import { PrismaClient, ItemStatus, ItemType, Priority, Swimlane, OpusType } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Passwords for seed users - change these as needed
  const creatorPassword = 'x'
  const stakeholderPassword = '2122'
  
  const hashedCreatorPassword = await bcrypt.hash(creatorPassword, 10)
  const hashedStakeholderPassword = await bcrypt.hash(stakeholderPassword, 10)
  
  const creator = await prisma.user.upsert({
    where: { name: 'condor' },
    update: {
      password: hashedCreatorPassword,
      role: 'CREATOR'
    },
    create: {
      name: 'condor',
      password: hashedCreatorPassword,
      role: 'CREATOR'
    }
  })

  const wife = await prisma.user.upsert({
    where: { name: 'estefani' },
    update: {
      password: hashedStakeholderPassword,
      role: 'STAKEHOLDER'
    },
    create: {
      name: 'estefani',
      password: hashedStakeholderPassword,
      role: 'STAKEHOLDER'
    }
  })

  console.log('Seed users:', creator.name, wife.name)

  // Create Opus records for projects
  const portfolioOpus = await prisma.opus.create({
    data: {
      name: "Portfolio Relaunch - aidev.international",
      content: "Transform into 'shut up and take my money' portfolio. Currently abandoned. Add AI Refill, update IngePro details.",
      opusType: OpusType.PORTFOLIO,
      createdByUserId: creator.id
    }
  })

  const ocdOpus = await prisma.opus.create({
    data: {
      name: "OCD Development",
      content: "Build the Opus Corpus Documenter system. Multi-user, AI-powered task management. Currently in Phase 0.",
      opusType: OpusType.PROJECT,
      createdByUserId: creator.id
    }
  })

  const bitsOpus = await prisma.opus.create({
    data: {
      name: "BITS - Standalone Product",
      content: "Productize the 7 AI Refill dashboards. Consume clean data, populate dashboards instantly.",
      opusType: OpusType.PROJECT,
      createdByUserId: creator.id
    }
  })

  const tragaldabasOpus = await prisma.opus.create({
    data: {
      name: "Tragaldabas + BITS Integration",
      content: "Universal Ingestor for Marco. Excel to PowerPoint in <1 minute. January delivery.",
      opusType: OpusType.PROJECT,
      createdByUserId: creator.id
    }
  })

  const cotizadorOpus = await prisma.opus.create({
    data: {
      name: "Cotizador - Solar Quote Tool",
      content: "Replace cryptic Excel for solar panel business. 1-week quick win project.",
      opusType: OpusType.PROJECT,
      createdByUserId: creator.id
    }
  })

  // Strategic items from your documents
  const strategicItems = [
    // URGENT - This Week
    {
      title: "Context Documents - Handover Prompt",
      rawInstructions: "Create meta-project for high-quality AI conversation handovers. Solve data corruption and repetition issues.",
      type: ItemType.TASK,
      status: ItemStatus.TODO,
      priority: Priority.HIGH,
      swimlane: Swimlane.PROJECT,
      labels: ["Strategic", "AI Workflow"],
      opusId: null,
    },
    
    // Daily Habits
    {
      title: "Content Creation - Daily",
      rawInstructions: "FIRST action of the day. Tax for AI Authority. If you code first, you never do it.",
      type: ItemType.TASK,
      status: ItemStatus.TODO,
      priority: Priority.HIGH,
      swimlane: Swimlane.HABIT,
      labels: ["Job 2 (Authority)", "Daily"],
      opusId: null,
    },
    {
      title: "GitHub Green - Daily Push",
      rawInstructions: "If it's not on GitHub, it didn't happen. EOD push mandatory.",
      type: ItemType.TASK,
      status: ItemStatus.TODO,
      priority: Priority.HIGH,
      swimlane: Swimlane.HABIT,
      labels: ["Job 2 (Authority)", "Daily"],
      opusId: null,
    },
    
    // Knowledge Base
    {
      title: "High Level Strategic Review",
      rawInstructions: "Core Strategic Conflict: Job 1 (Income Engine) vs Job 2 (Authority Engine). Addictive coding sabotages both.",
      type: ItemType.INFO,
      status: ItemStatus.COMPENDIUM,
      priority: Priority.HIGH,
      swimlane: Swimlane.PROJECT,
      labels: ["Strategy", "Reference"],
      opusId: null,
    },
    {
      title: "THE RULES",
      rawInstructions: "1. Don't lie. No assumptions. 2. World-class best practices. 3. Enterprise-grade software. 4. No mock data. 5. No cutting corners.",
      type: ItemType.INFO,
      status: ItemStatus.COMPENDIUM,
      priority: Priority.HIGH,
      swimlane: Swimlane.PROJECT,
      labels: ["Standards", "Reference"],
      opusId: null,
    },
  ]

  // Create all items with status history
  for (const itemData of strategicItems) {
    const item = await prisma.item.create({
      data: {
        ...itemData,
        createdByUserId: creator.id,
        capturedByUserId: creator.id,
        routingNotes: null,
        statusHistory: {
          create: {
            toStatus: itemData.status,
            changedById: creator.id,
          }
        }
      }
    })
    console.log(`Created item: ${item.title}`)
  }

  console.log('Created Opus records for projects')

  // Add system rules
  await prisma.rule.createMany({
    data: [
      { ruleKey: 'WIP_LIMIT', ruleValue: '1', description: 'Only one item in CREATING status allowed' },
      { ruleKey: 'EXPEDITE_MAX_AGE', ruleValue: '24', description: 'Expedite items older than 24 hours trigger warning' },
      { ruleKey: 'STALE_TODO_DAYS', ruleValue: '7', description: 'TODO items older than 7 days are highlighted' },
    ],
    skipDuplicates: true
  })

  console.log('Seeding completed!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())