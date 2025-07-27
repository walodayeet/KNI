const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedSampleData() {
  console.log('🌱 Seeding sample data...');

  try {
    console.log('Skipping study materials creation (will be handled by API)...');
    console.log('✅ Study materials will be created via API calls');

    // Create sample test questions
    const sampleQuestions = [
      {
        question: 'What is the derivative of x²?',
        options: ['2x', 'x', '2', 'x²'],
        correct_answer: '2x',
        subject_area: 'MATHEMATICS',
        difficulty: 'EASY',
        explanation: 'The derivative of x² is 2x using the power rule.',
        category: 'Calculus',
        tags: ['calculus', 'derivatives']
      },
      {
        question: 'Which of the following is Newton\'s second law?',
        options: ['F = ma', 'E = mc²', 'v = u + at', 'P = mv'],
        correct_answer: 'F = ma',
        subject_area: 'PHYSICS',
        difficulty: 'MEDIUM',
        explanation: 'Newton\'s second law states that Force equals mass times acceleration.',
        category: 'Mechanics',
        tags: ['physics', 'newton', 'laws']
      },
      {
        question: 'What is the chemical formula for water?',
        options: ['H2O', 'CO2', 'NaCl', 'CH4'],
        correct_answer: 'H2O',
        subject_area: 'CHEMISTRY',
        difficulty: 'EASY',
        explanation: 'Water consists of two hydrogen atoms and one oxygen atom.',
        category: 'Basic Chemistry',
        tags: ['chemistry', 'formulas', 'water']
      },
      {
        question: 'Which organelle is responsible for photosynthesis?',
        options: ['Mitochondria', 'Chloroplast', 'Nucleus', 'Ribosome'],
        correct_answer: 'Chloroplast',
        subject_area: 'BIOLOGY',
        difficulty: 'MEDIUM',
        explanation: 'Chloroplasts contain chlorophyll and are responsible for photosynthesis in plants.',
        category: 'Cell Biology',
        tags: ['biology', 'cells', 'photosynthesis']
      },
      {
        question: 'Solve for x: 2x + 5 = 13',
        options: ['4', '6', '8', '9'],
        correct_answer: '4',
        subject_area: 'MATHEMATICS',
        difficulty: 'EASY',
        explanation: '2x + 5 = 13, so 2x = 8, therefore x = 4.',
        category: 'Algebra',
        tags: ['algebra', 'equations']
      }
    ];

    console.log('Creating test questions...');
    const createdQuestions = [];
    for (const question of sampleQuestions) {
      const created = await prisma.test_questions.create({
        data: question
      });
      createdQuestions.push(created);
    }
    console.log(`✅ Created ${createdQuestions.length} test questions`);

    // Create sample mock tests
    const sampleMockTests = [
      {
        title: 'Mathematics Practice Test',
        description: 'Basic mathematics practice test for TestAS preparation.',
        subject_area: 'MATHEMATICS',
        difficulty: 'EASY',
        duration: 30, // 30 minutes
        total_questions: 2,
        passing_score: 70,
        instructions: 'Answer all questions to the best of your ability.',
        target_user_type: null, // Available to all
        status: 'ACTIVE'
      },
      {
        title: 'Science Comprehensive Test',
        description: 'Mixed science questions covering physics, chemistry, and biology.',
        subject_area: 'SCIENCE',
        difficulty: 'MEDIUM',
        duration: 45, // 45 minutes
        total_questions: 3,
        passing_score: 75,
        instructions: 'This test covers multiple science subjects.',
        target_user_type: 'PREMIUM',
        status: 'ACTIVE'
      }
    ];

    console.log('Creating mock tests...');
    const createdMockTests = [];
    for (const mockTest of sampleMockTests) {
      const created = await prisma.mock_tests.create({
        data: mockTest
      });
      createdMockTests.push(created);
    }
    console.log(`✅ Created ${createdMockTests.length} mock tests`);

    // Associate questions with mock tests
    console.log('Associating questions with mock tests...');
    
    // Math test gets math questions
    const mathQuestions = createdQuestions.filter(q => q.subject_area === 'MATHEMATICS');
    for (let i = 0; i < mathQuestions.length; i++) {
      await prisma.mock_test_questions.create({
        data: {
          mock_test_id: createdMockTests[0].id,
          question_id: mathQuestions[i].id,
          order_index: i + 1
        }
      });
    }

    // Science test gets science questions
    const scienceQuestions = createdQuestions.filter(q => 
      ['PHYSICS', 'CHEMISTRY', 'BIOLOGY'].includes(q.subject_area)
    );
    for (let i = 0; i < scienceQuestions.length; i++) {
      await prisma.mock_test_questions.create({
        data: {
          mock_test_id: createdMockTests[1].id,
          question_id: scienceQuestions[i].id,
          order_index: i + 1
        }
      });
    }

    console.log('✅ Associated questions with mock tests');

    console.log('🎉 Sample data seeding completed successfully!');
    console.log(`\nCreated:\n- 0 study materials (handled by API)\n- ${createdQuestions.length} test questions\n- ${createdMockTests.length} mock tests`);

  } catch (error) {
    console.error('❌ Error seeding sample data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding function
if (require.main === module) {
  seedSampleData()
    .then(() => {
      console.log('✅ Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedSampleData };