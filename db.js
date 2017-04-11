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
            // var cursor = db.collection('test').find( {Employeeid: 2} );

            // cursor.each(function(err, doc) {

            //     console.log(doc);

            // });
        });
        return "testString!!";
    },
    insertNewUser : function(username) {
        console.log("Trying to connect to mongodb");
        connectDB(function(db) {
            var cursor = db.collection('test').find( {Employeeid: 5} );
            cursor.each(function(err, doc) {
                if(!err) {
                    if (doc) {
                        console.log(doc);
                    } else{
                        console.log("It's Null!");
                    }
                } else {
                    console.log(err);
                }
            });
        });
    }
};

var connectDB = function(callback) {
    MongoClient.connect("mongodb://localhost:27017/dbstorage", function(err, db) {
        if(!err) {
            callback(db);
            db.close();
        } else {
            console.log("Could not connect to MongoDB");
        }
    });

}
