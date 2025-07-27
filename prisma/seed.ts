import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@kni-platform.com' },
    update: {},
    create: {
      email: 'admin@kni-platform.com',
      name: 'Admin User',
      password: await hash('admin123', 12),
      role: 'ADMIN',
    },
  })

  // Create test user
  const testUser = await prisma.user.upsert({
    where: { email: 'test@kni-platform.com' },
    update: {},
    create: {
      email: 'test@kni-platform.com',
      name: 'Test User',
      password: await hash('test123', 12),
      role: 'STUDENT',
    },
  })

  // Create teacher user
  const teacherUser = await prisma.user.upsert({
    where: { email: 'teacher@kni-platform.com' },
    update: {},
    create: {
      email: 'teacher@kni-platform.com',
      name: 'Teacher User',
      password: await hash('teacher123', 12),
      role: 'TEACHER',
    },
  })

  console.log('✅ Database seeded successfully!')
  console.log('📧 Test users created:')
  console.log('   Admin: admin@kni-platform.com / admin123')
  console.log('   Test: test@kni-platform.com / test123')
  console.log('   Teacher: teacher@kni-platform.com / teacher123')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })