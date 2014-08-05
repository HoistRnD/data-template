# All Template Engines Suck

This one sucks more than most. It is based on the ridiculous opinion that HTML templates should be written in HTML. `[tags]` in square brackets are totally alright for parametrizing text nodes and attributes, and custom attributes `data-lol` are super fine for providing logic.

This engine also sucks because it is designed to play nicely with Backbone.js.

## Statement

The library pollutes the global namespace with an object called `Template`. In order to digest the tags and logic elements provided in the HTML (which will be explained in due course), an initialization routine must be run using:

	Template.init();

When you have an element `el` (either a DOM element or a jQuery wrapped one) which you want to render using a given `model` (which can be anything JSON-like, or a Backbone.js model or collection), call:

	Template.render(el, model);
	
## Example

Let's say that this is your model:

	var model = {
		Name: "William Shakespeare",
		Birth: {
			Year: 1564,
			Country: "England"
		},
		PlayTypes: ["Comedy", "History", "Tragedy"],
		Plays: [
			{
				Title: "Romeo and Juliet",
				Type: 2
			},
			{
				Title: "Richard III",
				Type: 1
			},
			{
				Title: "A Midsummer Night's Dream",
				Type: 0
			}
		]
	};
	
And this is your DOM element:

	<article id="Playwright">
		<h1>[Name]</h1>
		
		<p>
			[Name] was born in the year [Birth.Year] in [Birth.Country].
		</p>
		
		<ul>
			<li data-each="Plays">[Title] ([.PlayTypes[Type]])</li>
		</ul>
	</article>
	
	var el = document.getElementById("Playwright");
	
Then calling `Template.render(el, model)` will do basically what you expect, producing

	<article id="Playwright">
		<h1>William Shakespeare</h1>
		
		<p>
			William Shakespeare was born in the year 1564 in England.
		</p>
		
		<ul>
			<li>Romeo and Juliet (Tragedy)</li>
			<li>Richard III (History)</li>
			<li>A Midsummer Night's Dream (Comedy)</li>
		</li>
	</article>
	
## eXplanation
	
Basically, there is a stack of scopes. The `data-each` attribute will duplicate the given element
for each member of the specified array or Backbone collection, and will push each member onto
the scope stack for expressions inside that element. To refer to the whole current scope, you can
use a dot `.`. To refer to an element of a previous scope, prefix your path with a `.`. To
access a property whose name is the value of another property, use brackets.

Here are all the other attributes that look like `data-each`:

- `data-if` will only generate the element if the expression evaluates truthy
- `data-unless` will only generate the element if the expression evalutates falsy
- `data-if-empty` does what it says
- `data-if-nonempty` does what it says
- `data-with` is like `data-if`, but also pushes the expression onto the scope stack
- `data-with-nonempty` does a similar thing for `data-if-nonempty`
- `data-with-always` will always generate the element and push the expression onto the scope stack