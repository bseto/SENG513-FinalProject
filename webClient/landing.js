var socket = io();

function login() {
	var username = document.getElementById("login-username").value;
	var password = document.getElementById("login-password").value;

	socket.emit('login', {username: username, password: password});	
}

function register() {
	var username = document.getElementById("register-username").value;
	var password = document.getElementById("register-password").value;
	var type = document.getElementById("register-type").value.toLowerCase();

	socket.emit('register', {username: username, password: password, type: type});		
}

$(function () {
	socket.on('connect', function(data) {
		let cookie = Cookies.getJSON('profile');
		if ( cookie ) {
			if ( cookie.type == "user")
				window.location.href = "/chat";
			if ( cookie.type == "staff" )
				window.location.href = "/staff";
		}

		socket.emit('userConnected', null);
    });
    socket.on('login-result', function(data) {
    	if(data) {
			console.log('Login success with: ' + JSON.stringify(data));
			Cookies.set('profile', {
				username: data.Username,
				userid: data._id,
				type: data.Type,
				color: data.Color
			});

			if ( data.Type == "user" )
    			window.location.href = "/chat";
			if ( data.Type == "staff" )
				window.location.href = "/staff";
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