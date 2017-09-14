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
            session.beginDialog('recognizeLandmark', { imageUrl: session.dialogData.imageUrl });
        }
    },
    (session, results) => {
        if (results.response.isLandmark) {
            session.beginDialog('learnMore',{ landmark: results.response.landmark });
        } else if (results.response.wrongEntityGuess) {
            session.beginDialog('recognizeWebEntity', { imageUrl: session.dialogData.imageUrl, secondTry: true, entityChoice:1 });
        } else {
            const { previousGuess, landmark } = results.response;
            session.beginDialog('recognizeWebEntity', { imageUrl: session.dialogData.imageUrl, secondTry: true, previousGuess, landmark });
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
                session.replaceDialog('verifyLandmark', { landmark });
            } else {
                session.replaceDialog('recognizeWebEntity', { imageUrl });
            }
        });
    }
]);


bot.dialog('recognizeWebEntity', [
    (session, args) => {
        const imageUrl = args.imageUrl;
        const previousGuess = '' || args.landmark;
        let entityChoice = 0;
        let uncertainMessage = "I'm really not sure.. I think it might be the %s.";
        if (args.entityChoice) {
            entityChoice = 1;
            uncertainMessage = "How about the %s?";
        }
        
        LandmarkRecognizer.getWebEntities(imageUrl).then(entities => {
            const landmark = entities[entityChoice];
            if (previousGuess === landmark) {
                session.send(`I\'m pretty sure that is ${landmark} :)`);
            } else {
                session.send(uncertainMessage,landmark);
                session.replaceDialog('verifyLandmark', { wrongEntityGuess: true, landmark });
            }
        });
    }
])

bot.dialog('verifyLandmark', [
    (session, args) => {
        let correctGuessMsg = "Yes, that's the one!";
        let wrongGuessMsg = "Nope, try again, buddy.";
        session.dialogData.landmark = args.landmark;
        session.dialogData.wrongEntityGuess = false;

        if (args.secondTry) {
            correctGuessMsg = "Yes, you got it this time.";
            wrongGuessMsg = "Sorry, wrong guess again.";
        }
        if (args.wrongEntityGuess) {
            session.dialogData.wrongEntityGuess = args.wrongEntityGuess;
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
    (session, results) => {
        let isLandmark;
        results.response.includes('Yes') ? isLandmark = true : isLandmark = false;
        session.endDialogWithResult({
            response: {
                landmark : session.dialogData.landmark,
                isLandmark,
                wrongEntityGuess: session.dialogData.wrongEntityGuess
            }
        });
    }
]);

bot.dialog('learnMore', [
    (session,args) => {
        const landmark = args.landmark;
        var msg = new builder.Message(session);
        msg.attachmentLayout(builder.AttachmentLayout.carousel);
        _getLandmarkInfo(landmark,session).then(factCards => {
            msg.attachments(factCards);
            session.send(msg).endDialog();
        })
    }
])

function _getLandmarkInfo (landmark,session) {
    const factCards = [];
    return new Promise((resolve, reject) => {
        LandmarkRecognizer.summarizeArticle(landmark).then(facts => {
            facts.forEach((fact,idx) => {
                
                factCards.push(new builder.HeroCard(session)
                                .title("Did you know that?")
                                .subtitle(`Fact #${idx}`)
                                .text(fact)
                );
            })
            resolve(factCards);
        })
    })
}