var socket = io();
var myName = '';
var myID = '';
var myColor = '#000000';
var myRoom = '';

$(function () {
    if ( Cookies.getJSON('profile') ) {
        myName = Cookies.getJSON('profile').username;
        myID = Cookies.getJSON('profile').userid;
        myColor = Cookies.getJSON('profile').color;
    } else {
        window.location.href = "http://localhost:3000/";
    };

    var tabTitle = $("#tab_title"), tabContent = $( "#tab_content" ),
    tabTemplate = "<li><a href='#{href}'>#{tabLabel}</a> <span class='ui-icon ui-icon-close'>Remove Tab</span></li>",
    tabCounter = 1, tabsOpen = 0, tabIndex = 0;
    
    var tabs = $("#tabs").tabs();
    
    // adding tabs functionality
    function addTab() {
        var label = tabTitle.val() || "Tab " + tabCounter,
            id = "tab-" + tabCounter,
            li = $( tabTemplate.replace( /#\{href\}/g, "#" + id ).replace( /#\{tabLabel\}/g, label ) );            
        tabs.find( ".ui-tabs-nav" ).append( li );
        tabs.append( "<div id='" + id + "' style=\"padding-top: 0px; padding-bottom: 0px;\"><p>" + tabContentHtml + "</p></div>" );
        tabs.tabs( "refresh" );
        tabCounter++;            
    }
    
    // checks if new tab can be created (max 5 at a time)
    function newTab() {
        if (tabsOpen < 5){
            addTab();
            $("#tabs").tabs("option", "active", tabIndex); // set most recent as active tab
            tabsOpen++; // max tabs tracker
            tabIndex++; // active tabs tracker
        } else {
            $( function() {
                $( "#dialogTabs" ).dialog({modal: true});
            } );
        }
    }
    
    // close tab using UI icon
    $("#tabs").delegate( "span.ui-icon-close", "click", function() {
        var panelId = $( this ).closest( "li" ).remove().attr( "aria-controls" );
        $( "#" + panelId ).remove();
        tabsOpen--; // max tabs tracker
        tabIndex--; // active tabs tracker
        $("#tabs").tabs( "refresh" );
    });
    
    // opens tabs for queue list items on double click
    $(document).on('dblclick', '#queueList li', function(){
        newTab();
    });
    
    // button handling    
    // resolve ticket button - closes tabs
    $("#tabs").button().on('click', '#resolve_ticket', function() {
        var tabID = $(this).parents().eq(5).attr('id');
        // delete tab
        $("#resolve_ticket").parents().eq(6).find('li').each(function(){
            if ($(this).attr('aria-controls') == tabID){
                console.log($(this).attr('aria-controls'));
                $(this).remove();
            }});
        $("#tabs").tabs( "refresh" );
        
        // delete chat area
        $(this).parents().eq(5).remove();
        tabsOpen--; // max tabs tracker
        tabIndex--; // active tabs tracker
        $("#tabs").tabs( "refresh" );
    });
    
    // invite others button
    $("#tabs").button().on('click', '#invite_others', function() {
        $( "#dialogInvite" ).append(inviteOthersHTML);
        $( "#dialogInvite" ).dialog({
            modal: true,
            title: "Search For Support User",
            buttons: {
                'OK': function () {
                    socket.emit('inviteUser', $('#username').val().trim());
                }
            }, height: 300, width: 360,
            close: function() {
                $( this ).empty();
                $( this ).dialog('destroy');
            }});
    });
    
    // view user's chat history (placeholder - not yet implemented)
    $("#tabs").button().on('click', '#user_history', function() {
        $( "#dialogUserHistory" ).dialog({
            modal: true, 
            title: "User's Chat History", 
            buttons: {
                'OK': function () {
                    $(this).dialog('close');
                }
            },
            close: function() {
                $( this ).dialog('destroy');
            }
        });
    });
    
    // account settings
    $("#account_settings").button().on('click', function() {
        $("#dialogPane").empty();
        $("#dialogPane").append(accountSettingsHTML);

        $("#pwd").attr('placeholder', "********");
        $("#color").attr('placeholder', "#FFFFFFFF");

        $("#dialogPane").dialog({
            title: "Account Settings",
            autoOpen: false,
            height: 360,
            width: 360,
            modal: true,
            buttons: {
                "Confirm Changes": modifyAccountSettings,
                Cancel: function() {
                    $( this ).dialog('close');
                }
            },
            close: function() {
                $( this ).empty();
                $( this ).dialog('destroy');
            }
        });
        $( "#dialogPane" ).dialog('open');
    });
    
    // logout
    $( "#logout_button" ).button().on("click", function() {
        $("#dialogPane").empty();
        $("#dialogPane").append('<p>Are you sure you want to logout?</p>');
        $("#dialogPane").dialog({
            title: "Logout?",
            resizeable: false,
            height: "auto",
            width: 400,
            modal: true,
            buttons: {
                "Logout": function() {
                    Cookies.remove('profile');
                    $( this ).dialog('close');
                    window.location.href = "http://localhost:3000";
                },
                Cancel: function() {
                    $( this ).dialog('close');
                }
            },
            close: function() {
                $( this ).empty();
                $( this ).dialog('destroy');
            }
        });
        
        $( "#dialogPane" ).dialog('open');
    });

    socket.on('connect', function (data) {
        socket.emit('userConnected', Cookies.getJSON('profile'));
        socket.emit('retrieveTicketQueue', Cookies.getJSON('profile'));
    });
    
    socket.on('queueRetrieval', function(data) {
        if ( !data )
            return;

        for ( let ticket of data ) {
            $('#queueList').append($('<li>').html(
                '<b>Number: </b>' + ticket.ticketNo + '<br>' +
                '<b>Title: </b>' + ticket.title + '<br>' +
                '<b>Created: </b>' + ticket.created
            ));
        }
    });

    socket.on('message', function (data) {
        console.log(data);
        $('#messageList').append($('<li>').html(buildMessageString(data)));

        if ( $('#messageList').scrollTop() >= ( $('#messageList')[0].scrollHeight - $('#messageList').height() - 100 ) ) {
            $('#messageList').scrollTop($('#messageList')[0].scrollHeight);
        }
    });

    socket.on('serverMessage', function (data) {
        handleServerMessage(data);
    });

    inviteOtherUser = function() {
        $("#dialogPane").empty();
        $("#dialogPane").dialog({
            title: "Select User",
            resizeable: false,
            height: "auto",
            modal: true,
            buttons: {
                "Confirm": function() {
                    console.log("DONT DO THIS YET");
                    socket.emit('inviteUser', null);
                    $( this ).dialog('close');
                },
                Cancel: function() {
                    $( this ).dialog('close');
                }
            },
            close: function() {
                $( this ).empty();
                $( this ).dialog('destroy');
            }
        });

        $( "#dialogPane" ).dialog('open');
    };

    modifyAccountSettings = function() {
        if ( $("#pwd").val().trim().length < 6) {
            $("#pwd").addClass( "ui-state-error" );
            $(".validateTips").text("Your password must be at least 6 characters.").addClass( "ui-state-highlight" );
            setTimeout(function() {
                $(".validateTips").removeClass( "ui-state-highlight", 1500 );
            }, 250 );
            return false;            
        }

        let newColor = $("#color").val().match(/(^#[0-9a-fA-F]{6})/g);
        if ( !newColor ) {
            $("#color").addClass( "ui-state-error" );
            $(".validateTips").text("Your color selection must be in the form #FFFFFF").addClass( "ui-state-highlight" );
            setTimeout(function() {
                $(".validateTips").removeClass( "ui-state-highlight", 1500 );
            }, 250 );
            return false;   
        }

        socket.emit('updateAccountSettings', {
            userid: myID,
            username: myName,
            type: Cookies.getJSON('profile').type,
            pwd: $("#pwd").val(),
            color: newColor[0]
        });
    };

    socket.on('update-result', function(result) {
        $("#resultDialog").empty();
        let okfunc = function(){};
        let title = "";
        if ( result ) {
            $("#resultDialog").append('<p>Successfully updated user information.</p>');
            okfunc = function() {
                $("#resultDialog").dialog('close');
                $("#dialogPane").dialog('close');
            }
            title = "Success";
        } else {
            $("#resultDialog").append('<p>Couldn\'t update your information, please try again.</p>');
            okfunc = function() {
                $("#resultDialog").dialog('close');
            }
            title = "Error";
        }

        $("#resultDialog").dialog({
                title: title,
                resizeable: false,
                height: "auto",
                modal: true,
                buttons: {
                    Ok: okfunc
                },
                close: function(){
                    $( this ).empty();
                    $( this ).dialog('destroy');
                }
            });
    });

    $("#textField").keyup(function (e) {
        if (e.keyCode == 13) {	
            sendMessage();
        }
    });

    buildMessageString = function (data) {
        let string = '';
        if (data.userId === socket.id || data.username == myName)
            string = '<b>[' + data.timestamp + '] <font color="' + data.color + '">' + data.username + "</font>: " + data.message + '</b>';
        else
            string = '<b>[' + data.timestamp + '] <font color="' + data.color + '">' + data.username + "</font>: </b>" + data.message;

        return string;
    };

    sendMessage = function () {
        socket.emit('message', {
            username: myName,
            userId: socket.id,
            color: myColor,
            namespace: myRoom,
            message: $('#textField').val()
        });
        $('#textField').val('');
    };

    clearChatHistory = function() {
        $('#messageList').empty();
    };

    clearUserList = function() {
        $('#userList').empty();
    };

    handleServerMessage = function (data) {
        if (data.color) {
            myColor = data.color;
        }
        if (data.username) {
            myName = data.username;
        }
        if (data.namespace) {
            myRoom = data.namespace;
        }
        if (data.userList) {
            clearUserList();
            for ( let user of data.userList ) {
                $('#userList').append($('<li>').html('<b><font color="' + user.color + '">' + user.username + '</font></b>'));
            }
        }
        if (data.chatHistory) {
            clearChatHistory();
            for ( let entry of data.chatHistory ) {
                if ( entry.serverMessage ) {
                    entry.username = 'Server';
                    entry.color = "red";
                    // made this queueList instead of messageList for testing purposes, pls revert
                    $('#queueList').append($('<li>').css('color', "red").html(buildMessageString(entry)));
                } else {
                    $('#queueList').append($('<li>').html(buildMessageString(entry)));
                }
            }
            //$('#messageList').scrollTop($('#messageList')[0].scrollHeight);
        }
        if (data.message) {
            data.username = 'Server';
            data.color = "red";
            $('#messageList').append($('<li>').css('color', "red").html(buildMessageString(data)));
                if ( $('#messageList').scrollTop() >= ( $('#messageList')[0] - $('#messageList').height() - 100 ) ) {
                    $('#messageList').scrollTop($('#messageList')[0].scrollHeight);
                }
		    }
		    Cookies.set('profile', {
                username: myName,
                color: myColor,
                namespace: myRoom
            });
	  };

    var tabContentHtml = '<div id="chatArea"><div id="messageArea"><ul id="messageList"></ul></div><div id="buttonsArea"><div id="buttons" style="display: table; margin-top: 10px; height: 100%;"><ul style="width: 80%; height: 45%; display: table-cell;"><li style="margin-top: 10%;"><button id="user_history" class="button" style="font-size: 14px; padding: 12px 20px; width: 85%;">User History</button></li><li style="margin-top: 23%;"><button id="invite_others" class="button" style="font-size: 14px; padding: 12px 20px; width: 85%;">Invite Others</button></li><li style="margin-top: 23%;"><button id="resolve_ticket" class="button" style="font-size: 14px; padding: 12px 20px; width: 85%;">Resolve Ticket</button></li></ul></div></div><div id="controls"><textarea id="textField" placeholder="Enter text..."></textarea></div></div>';
    var inviteOthersHTML = '<div id="dialogContent"><div id="resultDialog"></div><form><fieldset><p class="validateTips">Invite another staff member to chat</p><label for="username">Staff Username: </label><input type="text" name="username" id="username" class="text ui-widget-content ui-corner-all" size="20" maxlength="15"><br></fieldset></form></div>';
    var accountSettingsHTML = '<div id="dialogContent"><div id="resultDialog"></div><form><fieldset><p class="validateTips">Please enter your info.</p><label for="pwd">Password: </label><input type="password" name="pwd" id="pwd" class="text ui-widget-content ui-corner-all" size="25" maxlength="20"><br><label for="color">Color: </label><br><input type="text" name="color" id="color" class="text ui-widget-content ui-corner-all" size="25" maxlength="7"></br></fieldset></form></div>';
});