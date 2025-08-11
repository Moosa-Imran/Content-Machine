// scripts/createAdmin.js
// Script to create admin users in the Data database Users collection

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function createAdminUser() {
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const db = client.db('Data');
        const usersCollection = db.collection('Users');
        
        // Admin user data
        const adminUser = {
            username: 'admin',
            password: 'admin123', // Change this to your desired password
            role: 'admin',
            createdAt: new Date(),
            updatedAt: new Date(),
            email: 'admin@contentmachine.com', // Optional
            status: 'active'
        };
        
        // Check if admin user already exists
        const existingUser = await usersCollection.findOne({ username: adminUser.username });
        
        if (existingUser) {
            console.log('Admin user already exists!');
            console.log('Username:', existingUser.username);
            console.log('Role:', existingUser.role);
            return;
        }
        
        // Create the admin user
        const result = await usersCollection.insertOne(adminUser);
        
        console.log('✅ Admin user created successfully!');
        console.log('Username: admin');
        console.log('Password: admin123');
        console.log('Role: admin');
        console.log('User ID:', result.insertedId);
        console.log('\n⚠️  IMPORTANT: Change the default password after first login!');
        
    } catch (error) {
        console.error('Error creating admin user:', error);
    } finally {
        await client.close();
        console.log('Disconnected from MongoDB');
    }
}

// Run the script
createAdminUser();
