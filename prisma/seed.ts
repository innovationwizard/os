import { PrismaClient, ItemStatus, ItemType, Priority, Swimlane } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create your user
  const hashedPassword = await bcrypt.hash('change-this-password', 10)
  const creator = await prisma.user.upsert({
    where: { email: 'jorgeluiscontrerasherrera@gmail.com' },
    update: {},
    create: {
      email: 'jorgeluiscontrerasherrera@gmail.com',
      password: hashedPassword,
      role: 'CREATOR'
    }
  })

  console.log('Created user:', creator.email)

  // Strategic items from your documents
  const strategicItems = [
    // URGENT - This Week
    {
      title: "Portfolio Relaunch - aidev.international",
      rawInstructions: "Transform into 'shut up and take my money' portfolio. Currently abandoned. Add AI Refill, update IngePro details.",
      type: ItemType.PROJECT,
      status: ItemStatus.TODO,
      priority: Priority.HIGH,
      swimlane: Swimlane.PROJECT,
      labels: ["Job 2 (Authority)", "Portfolio"],
    },
    {
      title: "Context Documents - Handover Prompt",
      rawInstructions: "Create meta-project for high-quality AI conversation handovers. Solve data corruption and repetition issues.",
      type: ItemType.TASK,
      status: ItemStatus.TODO,
      priority: Priority.HIGH,
      swimlane: Swimlane.PROJECT,
      labels: ["Strategic", "AI Workflow"],
    },
    
    // Active Projects
    {
      title: "SSOT Development",
      rawInstructions: "Build the Single Source of Truth system. Multi-user, AI-powered task management. Currently in Phase 0.",
      type: ItemType.PROJECT,
      status: ItemStatus.CREATE,
      priority: Priority.HIGH,
      swimlane: Swimlane.PROJECT,
      labels: ["Product", "Both Jobs"],
      startedAt: new Date(),
    },
    {
      title: "BITS - Standalone Product",
      rawInstructions: "Productize the 7 AI Refill dashboards. Consume clean data, populate dashboards instantly.",
      type: ItemType.PROJECT,
      status: ItemStatus.TODO,
      priority: Priority.MEDIUM,
      swimlane: Swimlane.PROJECT,
      labels: ["Job 1 (Income)", "Product"],
    },
    
    // Scheduled
    {
      title: "Tragaldabas + BITS Integration",
      rawInstructions: "Universal Ingestor for Marco. Excel to PowerPoint in <1 minute. January delivery.",
      type: ItemType.PROJECT,
      status: ItemStatus.ON_HOLD,
      priority: Priority.MEDIUM,
      swimlane: Swimlane.PROJECT,
      labels: ["Job 1 (Income)", "January 2025"],
    },
    {
      title: "Cotizador - Solar Quote Tool",
      rawInstructions: "Replace cryptic Excel for solar panel business. 1-week quick win project.",
      type: ItemType.PROJECT,
      status: ItemStatus.TODO,
      priority: Priority.LOW,
      swimlane: Swimlane.PROJECT,
      labels: ["Portfolio", "Quick Win"],
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
    },
    {
      title: "GitHub Green - Daily Push",
      rawInstructions: "If it's not on GitHub, it didn't happen. EOD push mandatory.",
      type: ItemType.TASK,
      status: ItemStatus.TODO,
      priority: Priority.HIGH,
      swimlane: Swimlane.HABIT,
      labels: ["Job 2 (Authority)", "Daily"],
    },
    
    // Knowledge Base
    {
      title: "High Level Strategic Review",
      rawInstructions: "Core Strategic Conflict: Job 1 (Income Engine) vs Job 2 (Authority Engine). Addictive coding sabotages both.",
      type: ItemType.INFO,
      status: ItemStatus.LIBRARY,
      priority: Priority.HIGH,
      swimlane: Swimlane.PROJECT,
      labels: ["Strategy", "Reference"],
    },
    {
      title: "THE RULES",
      rawInstructions: "1. Don't lie. No assumptions. 2. World-class best practices. 3. Enterprise-grade software. 4. No mock data. 5. No cutting corners.",
      type: ItemType.INFO,
      status: ItemStatus.LIBRARY,
      priority: Priority.HIGH,
      swimlane: Swimlane.PROJECT,
      labels: ["Standards", "Reference"],
    },
  ]

  // Create all items with status history
  for (const itemData of strategicItems) {
    const item = await prisma.item.create({
      data: {
        ...itemData,
        createdByUserId: creator.id,
        statusHistory: {
          create: {
            toStatus: itemData.status,
            changedById: creator.id,
          }
        }
      }
    })
    console.log(`Created: ${item.title}`)
  }

  // Add system rules
  await prisma.rule.createMany({
    data: [
      { ruleKey: 'WIP_LIMIT', ruleValue: '1', description: 'Only one item in CREATE status allowed' },
      { ruleKey: 'EXPEDITE_MAX_AGE', ruleValue: '24', description: 'Expedite items older than 24 hours trigger warning' },
      { ruleKey: 'STALE_TODO_DAYS', ruleValue: '7', description: 'TODO items older than 7 days are highlighted' },
    ]
  })

  console.log('Seeding completed!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())