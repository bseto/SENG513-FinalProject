var socket = io();

function login() {
	var username = document.getElementById("login-username").value;
	var password = document.getElementById("login-password").value;

	socket.emit('login', {username: username, password: password});	
}

function register() {
	var username = document.getElementById("register-username").value;
	var password = document.getElementById("register-password").value;

	socket.emit('register', {username: username, password: password});		
}

$(function () {
	socket.on('connect', function(data) {
		let type = Cookies.getJSON('profile').type;
		if (type == "user") {
			window.location.href = "http://localhost:3000/chat";
		}
		if (type == "IT" ) {
			window.location.href = "http://localhost:3000/staff";
		}
    });
    socket.on('login-result', function(data) {
    	if(data) {
			console.log('Login success with: ' + JSON.stringify(data));
			Cookies.set('profile', {
				username: data.Username,
				type: data.Type,
				color: data.Color
			});

			if ( data.Type == "user" ) {
    			window.location.href = "http://localhost:3000/chat";
			}
			if ( data.Type == "IT" ) {
				window.location.href = "http://localhost:3000/staff";
			}
    	}
    	else {
    		console.log('Login Unsuccessful');
			document.getElementById("login-result").innerHTML = "Login Unsuccessful";
			document.getElementById("register-result").innerHTML = "";
    	}
    });
    socket.on('registration-result', function(data) {
    	if(data) {
    		console.log('Registration Successful');
			document.getElementById("register-result").innerHTML = "Registration Successful";
			document.getElementById("login-result").innerHTML = "";
    	}
    	else {
    		console.log('Registration Unsuccessful');
    		document.getElementById("register-result").innerHTML = "Registration Unsuccessful";
			document.getElementById("login-result").innerHTML = "";
    	}
    })
});