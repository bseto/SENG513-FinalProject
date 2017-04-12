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
            var cursor = db.collection('test4').find( {} );

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
        return connectDB(function(db) {
            return checkDuplicate(db, username, function(available){
                if (available === true) {
                    connectDB(function(db) {
                        db.collection('test4').insertOne({
                            Username: username,
                            Type: type,
                            color: color
                        }).catch(function (error) {
                            console.log(error);
                        });;
                    });
                    return true;
                } else {
                    return false;
                }
            });

        });
    }
};

var checkDuplicate = function(db, username, callback) {
    var cursor = db.collection('test4').find( {Username: username} );
    cursor.each(function(err, doc) {
        if(err) {
            console.log(err);
            return callback(false);
        } else {
            if (doc) {
                //If doc exists, it means username exists in the db
                return callback(false);
            } else{
                return callback(true);
            }
        }
    });
}

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
