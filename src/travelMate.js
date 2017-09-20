var restify = require('restify');
var builder = require('botbuilder');
const LandmarkRecognizer = require('./landmarkRecognizer');
const FactFinder = require('./factFinder');
const SimilarityChecker = require('./similarityChecker');


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
        const { landmark } = results.response;
        session.dialogData.landmark = landmark;

        if (results.response.isLandmark === 'maybe') {
            session.beginDialog('recognizeWebEntity', { imageUrl: session.dialogData.imageUrl, secondGuess: true, kindOf: true, previousGuess: landmark });
        }
        else if (results.response.isLandmark) {
            session.replaceDialog('learnMore', { landmark: results.response.landmark });
        }
        else if (results.response.wrongEntityGuess) {
            session.beginDialog('recognizeWebEntity', { imageUrl: session.dialogData.imageUrl, secondGuess: true });
        } else {
            session.beginDialog('recognizeWebEntity', { imageUrl: session.dialogData.imageUrl, previousGuess: landmark });
        }
    },
    (session, results) => {
        if (results.response.isLandmark === 'maybe') {
            session.replaceDialog('cannotRecognize', { previousGuess: session.dialogData.landmark });
        }
        else if (results.response.isLandmark) {
            session.dialogData.landmark = results.response.landmark;
            session.replaceDialog('learnMore', { landmark: results.response.landmark });
        } else {
            session.replaceDialog('cannotRecognize', { previousGuess: session.dialogData.landmark });
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
            if (landmark !== null) {
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
        session.sendTyping();
        const imageUrl = args.imageUrl;
        const previousGuess = '' || args.previousGuess;
        let entityChoice = 0;
        let uncertainMessage = "I'm really not sure.. I think it might be the %s.";
        if (args.secondGuess) {
            entityChoice = 1;
            uncertainMessage = "How about the %s?";
            session.dialogData.secondTry = true;
        }

        LandmarkRecognizer.getWebEntities(imageUrl).then(entities => {
            const landmark = entities[entityChoice];

            if (!landmark) {
                session.replaceDialog('cannotRecognize');
            } else {
                if (landmark.includes(previousGuess)) {
                    let iAmSureMsg;
                    dontMessWithMeMsg = args.kindOf ? `What do you mean "KIND OF" >:( ? I'm sure that's the ${landmark}.` : `I\'m pretty sure that is the ${landmark} :)`;
                    session.send(dontMessWithMeMsg);
                    session.replaceDialog('learnMore', { landmark, avoidRepetition: true });
                } else {
                    session.send(uncertainMessage, landmark);
                    session.replaceDialog('verifyLandmark', { wrongEntityGuess: true, landmark, secondTry: session.dialogData.secondTry });
                }
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
                    builder.CardAction.imBack(session, "Aah! You're close, but not exactly.", "Kind of."),
                    builder.CardAction.imBack(session, wrongGuessMsg, "No.")
                ]
            ));

        builder.Prompts.text(session, verifyLandmarkMsg);
    },
    (session, results) => {
        let isLandmark;

        if (results.response.includes('Yes')) {
            isLandmark = true;
        } else if (results.response.includes('exactly')) {
            isLandmark = 'maybe';
        } else {
            isLandmark = false;
        }

        session.endDialogWithResult({
            response: {
                landmark: session.dialogData.landmark,
                isLandmark,
                wrongEntityGuess: session.dialogData.wrongEntityGuess
            }
        });
    }
]);

bot.dialog('learnMore', [
    (session, args) => {
        const landmark = args.landmark;
        let moreInfoMsg;
        moreInfoMsg = args.avoidRepetition ? 'Let me give you some info about it.' : `Let me give you some info about the ${landmark}.`;
        if (args.justLearnt) {
            session.send('Oh! Thank you for telling me that.');
        }

        session.sendTyping();
        setTimeout(() => {
            session.send(moreInfoMsg);
            session.sendTyping();
            var msg = new builder.Message(session);
            msg.attachmentLayout(builder.AttachmentLayout.carousel);
            _getLandmarkInfo(landmark, session).then(factCards => {
                msg.attachments(factCards);
                session.send(msg).replaceDialog('anythingElse');
            })
        }, 2000);
    }
])

function _getLandmarkInfo(landmark, session) {
    const factCards = [];
    return new Promise((resolve, reject) => {
        FactFinder.summarizeArticle(landmark, 'en').then(facts => {
            facts.forEach((fact, idx) => {

                factCards.push(new builder.HeroCard(session)
                    .title("Did you know that?")
                    .subtitle(`Fact #${idx + 1}`)
                    .text(fact)
                );
            })
            resolve(factCards);
        })
    })
}

bot.dialog('cannotRecognize', [
    (session, args) => {
        let giveUpMessage = "Shoot! I give up. What's the name of this landmark?";
        if (args) {
            session.dialogData.previousGuess = args.previousGuess;
            if (args.almostThere) {
                giveUpMessage = "Dang it! So, what is it?";
            }
        }
        builder.Prompts.text(session, giveUpMessage);
    },
    (session, results) => {
        const previousGuess = session.dialogData.previousGuess;
        if (SimilarityChecker.check(previousGuess, results.response) > 0.85) {
            session.replaceDialog('areYouMessingWithMe', { previousGuess })
        } else {
            session.replaceDialog('learnMore', { landmark: results.response, justLearnt: true });
        }
    }
])

bot.dialog('areYouMessingWithMe', [
    (session, args) => {
        session.dialogData.previousGuess = args.previousGuess;
        session.send(`I knew it was the ${session.dialogData.previousGuess}. Why are you messing with me?`);

        const ensureUserWantsInfoMsg = new builder.Message(session)
            .text(`Do you want to learn something about the it?`)
            .suggestedActions(

            builder.SuggestedActions.create(
                session, [
                    builder.CardAction.imBack(session, "Yes, sorry about that.", "Yes!"),
                    builder.CardAction.imBack(session, "No, that's alright. I just wanted to have some fun.", "No.")
                ]
            ));
        builder.Prompts.text(session, ensureUserWantsInfoMsg);
    },
    (session, results) => {
        if (results.response.includes('Yes')) {
            session.replaceDialog('learnMore', { landmark: session.dialogData.previousGuess })
        } else {
            session.endConversation("Okay, goodbye then :).");
        }
    }
]);


bot.dialog('anythingElse', (session) => {
    session.send("Anything else I can help you with?");
})

// TODO: New dialog 'Do you want anything else?
// Nevsky -> Kind of -> No -> No reply ..
// Monumento -> No -> Kind of -> Let me give you some info ..