const assert = require("assert");

describe("testeing in yemot-router", () => {

	describe("testing response_functions", () => {

		const response_functions = new (require("../lib/response_functions"));

		describe("testeing make_read_response function", () => {

			const make_read_response = response_functions.make_read_response;

			let message = [];
			let options = {};
			let r = "";

			it("", () => {

				message = [{ type: "text", data: "hay, is text!" }];

				r = make_read_response(message, "tap", options);

				assert.equal(r[0], "read=t-hay, is text!=,val_1,no,*,1,7,Number,false,true,,,,");
				assert.equal(r[1], "val_1");
			});

		});
	});

});