var socket = io();
var myName = '';
var myID = '';
var myColor = '#000000';
var myRoom = '';

var map_ticketNoToTicket = new Map();
var map_roomToTicket = new Map();

$(function () {
    if ( Cookies.getJSON('profile') ) {
        myName = Cookies.getJSON('profile').username;
        myID = Cookies.getJSON('profile').userid;
        myColor = Cookies.getJSON('profile').color;
    } else {
        window.location.href = "http://localhost:3000/";
    };

    var tabContent = $( "#tab_content" );
    var tabTemplate = "<li id='#{tabId}'><a href='#{href}'>#{tabLabel}</a> <span class='ui-icon ui-icon-close'>Remove Tab</span></li>";
    var tabIndex = 0;
    
    var tabs = $("#tabs").tabs();
    
    /*// close tab using UI icon
    $("#tabs").delegate( "span.ui-icon-close", "click", function() {
        var panelId = $( this ).closest( "li" ).remove().attr( "aria-controls" );
        $( "#" + panelId ).remove();
        tabIndex--; // active tabs tracker
        $("#tabs").tabs( "refresh" );
    });*/
    
    // button handling
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
            buildTicketEntry(ticket);
        }
    });

    socket.on('queueUpdate', function(data) {
        if ( !data )
            return;
        
        if ( data.mode == "add" ) {
            let ticket = data.ticket;

            if ( !ticket || !ticket.ticketNo || !ticket.title || !ticket.created ) {
                console.log("Malformed ticket retrieved: " + JSON.stringify(ticket));
                return;
            }

            buildTicketEntry(ticket);
        }

        if ( data.mode == "remove" ) {
            $('#tListNo'+data.ticketNo).remove();
        }
    });

    socket.on('ticketRetrieved', function(data) {
        map_ticketNoToTicket.set(data.ticketNo, data);
        map_roomToTicket.set(data.room, data);
    });

    socket.on('message', function (data) {
        let ticket = map_roomToTicket.get(data.room);
        if ( !ticket )
            return;

        ticketNumber = ticket.ticketNo;

        $('#messageList'+ticketNumber).append($('<li>').html(buildMessageString(data)));

        if ( $('#messageList'+ticketNumber).scrollTop() >= 
            ( $('#messageList'+ticketNumber)[0].scrollHeight - $('#messageList'+ticketNumber).height() - 100 ) ) {
                $('#messageList'+ticketNumber).scrollTop($('#messageList'+ticketNumber)[0].scrollHeight);
        }
    });

    socket.on('serverMessage', function (data) {
        handleServerMessage(data);
    });

    socket.on('inviteUser-response', function(data) {
        let title = '';
        let okfunc = '';
        $("#dialogPane").empty();

        if ( data ) {
            $("#dialogPane").append('<p>The specified user been notified</p>');
            title = 'Success';
            okfunc = function() {
                $('#dialogPane').dialog('close');
                $('#dialogInvite').dialog('close');
            }
        } else {
             $("#dialogPane").append('<p>Couldn\'t find the user specified</p>');
            title = 'Error';
            okfunc = function() {
                $('#dialogPane').dialog('close');
            }
        }

        $("#dialogPane").dialog({
            title: title,
            resizeable: false,
            modal: true,
            buttons: {
                OK: okfunc
            },
            close: function() {
                $( this ).empty();
                $( this ).dialog('destroy');
            }
        });

        $( "#dialogPane" ).dialog('open');
    });

    socket.on('chatroomInvitation', function(data) {
        if ( !data )
            return;

        $("#invitationPane").empty();
        $("#invitationPane").append('<p>You have been invited by ' + data + ' to join their chatroom</p>');

        $("#invitationPane").dialog({
            title: "Invitation Received",
            resizeable: false,
            modal: true,
            buttons: {
                Join: function() {
                    socket.emit('joinChatroom', {
                        response: true,
                        sender: data
                    } );
                    $( this ).dialog('close');
                },
                Cancel: function() {
                    socket.emit('joinChatroom', {
                        response: false,
                        sender: data
                    } );
                    $( this ).dialog('close');
                }
            },
            close: function() {
                $( this ).empty();
                $( this ).dialog('destroy');
            }
        });

        $( "#invitationPane" ).dialog('open');
    });

    socket.on('joinChatroom-response', function(data){
        if ( !data )
            return;

        if ( !data.response ) {
            $("#invitationPane").empty();
            $("#invitationPane").append('<p>' + data.sender + 'has declined to join your chatroom</p>');

            $("#invitationPane").dialog({
                title: "Invitation Declined",
                resizeable: false,
                modal: true,
                buttons: {
                    OK: function() {
                        $( this ).dialog('close');
                    }
                },
                close: function() {
                    $( this ).empty();
                    $( this ).dialog('destroy');
                }
            });

            $( "#invitationPane" ).dialog('open');
        }
    });

    // adding tabs functionality
    selectTicket = function( ticketNo ) {
        if (tabIndex >= 5){
            $( function() {
                $( "#dialogTabs" ).dialog({modal: true});
            } );
            return;
        }

        socket.emit('retrieveTicket', {
            ticketNo: ticketNo
        });

        let label = "TicketNo " + ticketNo;
        let id = "ticketTabChat" + ticketNo;
        let li = $( tabTemplate.replace( /#\{tabId\}/g, "ticketTab" + ticketNo ).replace( /#\{href\}/g, "#" + id ).replace( /#\{tabLabel\}/g, label ) );
        tabs.find( ".ui-tabs-nav" ).append( li );
        let customizedHTML = tabContentHtml.replace( /\{#ticketNumber\}/g, ticketNo );
        tabs.append( "<div id='" + id + "' style=\"padding-top: 0px; padding-bottom: 0px;\"><p>" + customizedHTML + "</p></div>" );
        tabs.tabs( "refresh" );

        $('#resolve_ticket' + ticketNo).button().on('click', function(){
            resolveTicket( ticketNo );
        }).data( 'ticket', ticketNo );
        $('#invite_others' + ticketNo).button().on('click', function() {
            inviteOthers( ticketNo );
        }).data( 'ticket', ticketNo );
        $('#textField' + ticketNo).keyup( function(e) {
            if (e.keyCode == 13) {	
                sendMessage( ticketNo );
            }
        });

        $('#messageList' + ticketNo)

        $("#tabs").tabs("option", "active", tabIndex); // set most recent as active tab
        tabIndex++; // active tabs tracker
    }

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

    buildTicketEntry = function( ticket ) {
        $('#queueList').append($('<li id=tListNo' + ticket.ticketNo + '>').html(
            '<div id=tButtonNo' + ticket.ticketNo + '></div>'
        ));

        $('#tButtonNo'+ticket.ticketNo).button({
            label: '<b>Number: </b>' + ticket.ticketNo + '<br><b>Title: </b>' + ticket.title + '<br><b>Created: </b>' + formatDate(ticket.created)
        }).addClass('ticketButton').on('click', function() {
            selectTicket( ticket.ticketNo );
        } );
    }

    // resolve ticket button - closes tabs
    resolveTicket = function( ticketNo ) {
        $('#ticketTab'+ticketNo).remove();
        $('#ticketTabChat'+ticketNo).remove();

        tabIndex--; // active tabs trcker
        $("#tabs").tabs( "refresh" );

        let ticket = map_ticketNoToTicket.get(ticketNo);
        map_ticketNoToTicket.delete(ticketNo);
        map_roomToTicket.delete(ticket.room);
    };

    // invite others button
    inviteOthers = function( ticketNo ) {
        $( "#dialogInvite" ).append(inviteOthersHTML);
        $( "#dialogInvite" ).dialog({
            modal: true,
            title: "Search For Support User",
            buttons: {
                OK: function () {
                    socket.emit('inviteUser', $('#username').val().trim() );
                },
                Cancel: function() {
                    $( this ).dialog('close');
                }
            }, height: 300, width: 360,
            close: function() {
                $( this ).empty();
                $( this ).dialog('destroy');
            }});
    };

    buildMessageString = function (data) {
        let string = '';
        if (data.userId === socket.id || data.username == myName)
            string = '<b>[' + data.timestamp + '] <font color="' + data.color + '">' + data.username + "</font>: " + data.message + '</b>';
        else
            string = '<b>[' + data.timestamp + '] <font color="' + data.color + '">' + data.username + "</font>: </b>" + data.message;

        return string;
    };

    sendMessage = function ( ticketNo ) {
        let ticket = map_ticketNoToTicket.get(ticketNo);

        socket.emit('message', {
            username: myName,
            color: myColor,
            room: ticket.room,
            message: $('#textField'+ticketNo).val()
        });
        $('#textField' + ticketNo).val('');
    };

    clearChatHistory = function( ticketNo ) {
        $('#messageList'+ticketNo).empty();
    };

    clearUserList = function() {
        $('#userList').empty();
    };

    handleServerMessage = function (data) {
        let dirty = false;
        if (data.color) {
            myColor = data.color;
            dirty = true;
        }
        if (data.username) {
            myName = data.username;
            dirty = true;
        }
        if ( dirty ) {
            Cookies.set('profile', {
				username: myName,
				userid: Cookies.getJSON('profile').userid,
				type: Cookies.getJSON('profile').type,
				color: myColor
            });
        }

        if ( !data.room )
            return;

        let ticket = map_roomToTicket.get(data.room);
        if ( !ticket )
            return;
        let ticketNumber = ticket.ticketNo;

        if (data.chatHistory) {
            clearChatHistory( ticketNumber );
            for ( let entry of data.chatHistory ) {
                if ( entry.serverMessage ) {
                    entry.username = 'Server';
                    entry.color = "red";
                    $('#messageList'+ticketNumber).append($('<li>').css('color', "red").html(buildMessageString(entry)));
                } else {
                    $('#messageList'+ticketNumber).append($('<li>').html(buildMessageString(entry)));
                }
            }
            $('#messageList'+ticketNumber).scrollTop($('#messageList'+ticketNumber)[0].scrollHeight);
        }
        if (data.message) {
            data.username = 'Server';
            data.color = "red";
            $('#messageList'+ticketNumber).append($('<li>').css('color', "red").html(buildMessageString(data)));
                if ( $('#messageList'+ticketNumber).scrollTop() >= ( $('#messageList'+ticketNumber)[0] - $('#messageList'+ticketNumber).height() - 100 ) ) {
                    $('#messageList'+ticketNumber).scrollTop($('#messageList'+ticketNumber)[0].scrollHeight);
                }
		    }

    };

    formatDate = function (data) {
        let date = new Date(data);
        let hh = date.getHours();
        if (hh < 10)
            hh = '0' + hh;

        let mm = date.getMinutes();
        if (mm < 10)
            mm = '0' + mm;

        let ss = date.getSeconds();
        if (ss < 10)
            ss = '0' + ss;

        return hh + ":" + mm + ":" + ss;
    };

    var tabContentHtml = '<div id="chatArea"><div id="messageArea"><ul id="messageList{#ticketNumber}" class="messageList"></ul></div><div id="buttonsArea"><div id="buttons" style="display: table; margin-top: 10px; height: 100%;"><ul style="width: 80%; height: 45%; display: table-cell;"><li style="margin-top: 10%;"><button id="user_history" class="button" style="font-size: 14px; padding: 12px 20px; width: 85%;">User History</button></li><li style="margin-top: 23%;"><button id="invite_others{#ticketNumber}" class="button" style="font-size: 14px; padding: 12px 20px; width: 85%;">Invite Others</button></li><li style="margin-top: 23%;"><button id="resolve_ticket{#ticketNumber}" class="button" style="font-size: 14px; padding: 12px 20px; width: 85%;">Resolve Ticket</button></li></ul></div></div><div id="controls"><textarea class="textField" id="textField{#ticketNumber}" placeholder="Enter text..."></textarea></div></div>';
    var inviteOthersHTML = '<div id="dialogContent"><div id="resultDialog"></div><form><fieldset><p class="validateTips">Invite another staff member to chat</p><label for="username">Staff Username: </label><input type="text" name="username" id="username" class="text ui-widget-content ui-corner-all" size="20" maxlength="15"><br></fieldset></form></div>';
    var accountSettingsHTML = '<div id="dialogContent"><div id="resultDialog"></div><form><fieldset><p class="validateTips">Please enter your info.</p><label for="pwd">Password: </label><input type="password" name="pwd" id="pwd" class="text ui-widget-content ui-corner-all" size="25" maxlength="20"><br><label for="color">Color: </label><br><input type="text" name="color" id="color" class="text ui-widget-content ui-corner-all" size="25" maxlength="7"></br></fieldset></form></div>';
});