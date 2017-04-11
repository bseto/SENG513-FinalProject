var MongoClient = require('mongodb').MongoClient
 , assert = require('assert');

var db_holder;

// Connect to the db
module.exports = {
    testString : function() {
        console.log("Trying to connect to mongodb");
        connectDB(function(db) {
            console.log("We are connected to the Database");
            // db.collection('test').insertOne({
            //     Employeeid: 2,
            //     EmployeeName: "Byrone"
            // });
            var cursor = db.collection('test3').find( {} );

            cursor.each(function(err, doc) {

                console.log(doc);

            });
            db.close();
        });
        return "testString!!";
    },
    //Type is either 'user' or 'IT'
    //Returns true if username is added
    //Returns false if username is already existing or if there is an error
    insertNewUser : function(username, type, color) {
        if (!username || !type || !color){
            console.log("insertNewUser: Not all arguments supplied");
            return false;
        } else {
            console.log(username + " " + type + " " + color);
        }
        var available = true;
        connectDB(function(db) {
            console.log("Checking for duplicate names:" + username);
            var cursor = db.collection('test3').find( {Username: username} );
            cursor.each(function(err, doc) {
                if(err) {
                    console.log(err);
                    available = false;
                } else {
                    if (doc) {
                        console.log(doc);
                        console.log("Already Exists");
                        available = false;
                    } else{
                        console.log("Username is available");
                    }
                }
            });
        });
        //TODO race condition w/o me knowing
        if (available === true) {
            console.log("ITS TRUE GUYS?");
            console.log("inserting " + username + " " + type + " " + color);
            connectDB(function(db) {
                db.collection('test3').insertOne({
                    Username: username,
                    Type: type,
                    color: color
                }).catch(function (error) {
                    console.log("Something went wrong");
                    console.log(error);
                });;
            });
            return true;
        } else {
            return false;
        }
    }
};

var connectDB = function(callback) {
    MongoClient.connect("mongodb://localhost:27017/dbstorage", function(err, db) {
        if(!err) {
            ret = callback(db);
            db.close();
            return ret;
        } else {
            console.log("Could not connect to MongoDB");
            return false;
        }
    });

}
