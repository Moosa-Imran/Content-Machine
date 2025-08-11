// scripts/userManager.js
// Script to manage users in the Data database Users collection

const { MongoClient } = require('mongodb');
require('dotenv').config();

class UserManager {
    constructor() {
        this.client = new MongoClient(process.env.MONGODB_URI);
        this.db = null;
        this.usersCollection = null;
    }

    async connect() {
        await this.client.connect();
        console.log('Connected to MongoDB');
        this.db = this.client.db('Data');
        this.usersCollection = this.db.collection('Users');
    }

    async disconnect() {
        await this.client.close();
        console.log('Disconnected from MongoDB');
    }

    async createUser(username, password, role = 'admin', email = null) {
        try {
            // Check if user already exists
            const existingUser = await this.usersCollection.findOne({ username });
            
            if (existingUser) {
                console.log(`❌ User '${username}' already exists!`);
                return false;
            }

            const user = {
                username,
                password, // Plain text for now
                role,
                email,
                createdAt: new Date(),
                updatedAt: new Date(),
                status: 'active'
            };

            const result = await this.usersCollection.insertOne(user);
            console.log(`✅ User '${username}' created successfully!`);
            console.log('User ID:', result.insertedId);
            return true;
        } catch (error) {
            console.error('Error creating user:', error);
            return false;
        }
    }

    async listUsers() {
        try {
            const users = await this.usersCollection.find({}).toArray();
            console.log('\n📋 All Users:');
            console.log('='.repeat(50));
            
            if (users.length === 0) {
                console.log('No users found.');
                return;
            }

            users.forEach((user, index) => {
                console.log(`${index + 1}. Username: ${user.username}`);
                console.log(`   Role: ${user.role}`);
                console.log(`   Email: ${user.email || 'Not set'}`);
                console.log(`   Status: ${user.status}`);
                console.log(`   Created: ${user.createdAt}`);
                console.log('   ' + '-'.repeat(30));
            });
        } catch (error) {
            console.error('Error listing users:', error);
        }
    }

    async deleteUser(username) {
        try {
            const result = await this.usersCollection.deleteOne({ username });
            
            if (result.deletedCount === 1) {
                console.log(`✅ User '${username}' deleted successfully!`);
                return true;
            } else {
                console.log(`❌ User '${username}' not found!`);
                return false;
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            return false;
        }
    }

    async updateUserPassword(username, newPassword) {
        try {
            const result = await this.usersCollection.updateOne(
                { username },
                { 
                    $set: { 
                        password: newPassword, 
                        updatedAt: new Date() 
                    } 
                }
            );

            if (result.matchedCount === 1) {
                console.log(`✅ Password updated for user '${username}'!`);
                return true;
            } else {
                console.log(`❌ User '${username}' not found!`);
                return false;
            }
        } catch (error) {
            console.error('Error updating password:', error);
            return false;
        }
    }
}

// Command line interface
async function main() {
    const userManager = new UserManager();
    await userManager.connect();

    const args = process.argv.slice(2);
    const command = args[0];

    try {
        switch (command) {
            case 'create':
                if (args.length < 3) {
                    console.log('Usage: node userManager.js create <username> <password> [role] [email]');
                    break;
                }
                await userManager.createUser(args[1], args[2], args[3] || 'admin', args[4]);
                break;

            case 'list':
                await userManager.listUsers();
                break;

            case 'delete':
                if (args.length < 2) {
                    console.log('Usage: node userManager.js delete <username>');
                    break;
                }
                await userManager.deleteUser(args[1]);
                break;

            case 'password':
                if (args.length < 3) {
                    console.log('Usage: node userManager.js password <username> <new_password>');
                    break;
                }
                await userManager.updateUserPassword(args[1], args[2]);
                break;

            default:
                console.log('Available commands:');
                console.log('  create <username> <password> [role] [email] - Create a new user');
                console.log('  list - List all users');
                console.log('  delete <username> - Delete a user');
                console.log('  password <username> <new_password> - Update user password');
                break;
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await userManager.disconnect();
    }
}

if (require.main === module) {
    main();
}

module.exports = UserManager;
