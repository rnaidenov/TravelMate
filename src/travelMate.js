var restify = require('restify');
var builder = require('botbuilder');
const LandmarkRecognizer = require('./landmarkRecognizer');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());


var bot = new builder.UniversalBot(connector, [
    function (session) {
        session.beginDialog('travel');
    }
]);

// bot.dialog('greet', (session) => {
//     session.userData.firstRun = true;
//     session.send("Hello, I am TravelMate. I want to be your personal, pocket tour guide.");
// }).triggerAction({
//     onFindAction: (context, callback) => {
//         if (!context.userData.firstRun) {
//             callback(null, 1.1);
//         } else {
//             callback(null, 0.0);
//         }
//     }
// })



bot.dialog("travel", [
    (session) => {
        const attachments = session.message.attachments;

        if (attachments && attachments.length > 0) {
            session.dialogData.imageUrl ? null : session.dialogData.imageUrl = attachments[0].contentUrl;
            session.beginDialog('recognizeLandmark', { imageUrl : session.dialogData.imageUrl });
        }
    },
    (session, results) => {
        if (results.response.isLandmark) {
            session.send("Yes, go me!");
        } else {
            const { previousGuess } = results.response;
            session.beginDialog('recognizeWebEntity', { imageUrl : session.dialogData.imageUrl, secondTry : true, previousGuess });
        }
    },
    (session, results) => {
        if (results.response.isLandmark) {
            session.send("Yes, go me!");
        } else {
            builder.Prompts.text(session, "Shoot! I give up. What is it?");
        }
        
    }
]);

bot.dialog('recognizeLandmark', [
    (session, args) => {
        // TODO: add id for images
        // Change to userData
        const imageUrl = args.imageUrl;

        session.send("Mmmm...");
        session.sendTyping();
        LandmarkRecognizer.recognize(imageUrl).then(landmark => {
            if (landmark) {
                session.send(`That looks like the ${landmark}.`);      
                session.replaceDialog('verifyLandmark', { previousGuess : landmark });
            } else {
                session.replaceDialog('recognizeWebEntity', { imageUrl });
            }
        });
    },
    (session, results) => {
        session.endDialogWithResult(results);
    }
]);


bot.dialog('recognizeWebEntity', [
    (session,args) => {
        const imageUrl = args.imageUrl;
        const previousGuess = '' || args.previousGuess;

        LandmarkRecognizer.getWebEntities(imageUrl).then(entities => {
            const landmark = entities[0];
            if(previousGuess===landmark) {
                session.send(`I\'m pretty sure that is ${landmark} :)`);
            } else {
                session.send(`I'm really not sure.. I think it might be the ${landmark}.`);
                session.replaceDialog('verifyLandmark');
            }
        });
    }
])

bot.dialog('verifyLandmark', [
    (session,args) => {
        let correctGuessMsg = "Yes, that's the one!";
        let wrongGuessMsg = "Nope, try again, buddy.";

        if (args) {
            if (args.secondTry) {
                correctGuessMsg = "Yes, you got it this time.";
                wrongGuessMsg = "Sorry, wrong guess again.";
            }
            if (args.previousGuess) {
                session.dialogData.previousGuess = args.previousGuess;
            }
        }

        const verifyLandmarkMsg = new builder.Message(session)
            .text("Am I right?")
            .suggestedActions(

            builder.SuggestedActions.create(
                session, [
                    builder.CardAction.imBack(session, correctGuessMsg, "Yes!"),
                    builder.CardAction.imBack(session, wrongGuessMsg, "No.")
                ]
            ));

        builder.Prompts.text(session, verifyLandmarkMsg);
    },
    (session,results) => {
        let isLandmark;
        results.response.includes('Yes') ? isLandmark = true : isLandmark = false;
        session.endDialogWithResult({ response: { 
            previousGuess : session.dialogData.previousGuess, 
            isLandmark 
        }});
    }
]);