const BASE_URL = "http://localhost:3000";

async function runTests() {
  try {
    console.log("🚀 Starting Customer App API Integration Tests...\n");
    const testPhone = `98765${Math.floor(10000 + Math.random() * 90000)}`;
    console.log(`📱 Test Phone Number: ${testPhone}\n`);

    // 1. Test send-otp for unregistered user
    console.log("⏳ 1. Requesting OTP for unregistered user...");
    const sendOtpRes = await fetch(`${BASE_URL}/api/customer-app/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: testPhone })
    });
    const sendOtpData = await sendOtpRes.json();
    console.log("Response:", JSON.stringify(sendOtpData, null, 2));
    if (!sendOtpRes.ok || !sendOtpData.success || sendOtpData.data.isRegistered !== true) {
      throw new Error("Failed send-otp test");
    }
    console.log("✅ send-otp test passed!\n");

    // 2. Test verify-otp (auto-registration)
    console.log("⏳ 2. Verifying OTP (expecting auto-registration)...");
    const verifyOtpRes = await fetch(`${BASE_URL}/api/customer-app/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: testPhone, otp: 1234 }) // numeric parameter check too!
    });
    const verifyOtpData = await verifyOtpRes.json();
    console.log("Response:", JSON.stringify(verifyOtpData, null, 2));
    if (!verifyOtpRes.ok || !verifyOtpData.success || !verifyOtpData.data.token) {
      throw new Error("Failed verify-otp test");
    }
    const token = verifyOtpData.data.token;
    console.log("✅ verify-otp auto-registration test passed!\n");

    // 2b. Test register with registerUser nested payload
    console.log("⏳ 2b. Registering new customer with nested registerUser payload...");
    const regPhone = `98765${Math.floor(10000 + Math.random() * 90000)}`;
    const registerRes = await fetch(`${BASE_URL}/api/customer-app/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registerUser: {
          name: "Tester",
          email: "testing@gmail.com",
          phone: regPhone,
          address1: "One West",
          address2: "Nanakramguda",
          city: "hyd",
          state: "Telangana",
          pincode: "500032"
        }
      })
    });
    const registerData = await registerRes.json();
    console.log("Response:", JSON.stringify(registerData, null, 2));
    if (!registerRes.ok || !registerData.success || registerData.data.user.name !== "Tester") {
      throw new Error("Failed register test");
    }
    console.log("✅ register test passed!\n");

    // 3. Test POST /addresses
    console.log("⏳ 3. Creating a new Address...");
    const createAddressRes = await fetch(`${BASE_URL}/api/customer-app/addresses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        fullName: "Jaswanth G",
        label: "Home",
        phone: testPhone,
        addressLine1: "456 Oak Lane",
        city: "Austin",
        state: "Texas",
        pincode: "78701",
        isDefault: true
      })
    });
    const createAddressData = await createAddressRes.json();
    console.log("Response:", JSON.stringify(createAddressData, null, 2));
    if (!createAddressRes.ok || !createAddressData.success) {
      throw new Error("Failed POST /addresses test");
    }
    const addressId = createAddressData.data._id;
    console.log("✅ POST /addresses test passed!\n");

    // 4. Test GET /addresses
    console.log("⏳ 4. Listing Addresses...");
    const listAddressRes = await fetch(`${BASE_URL}/api/customer-app/addresses`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });
    const listAddressData = await listAddressRes.json();
    console.log("Response:", JSON.stringify(listAddressData, null, 2));
    if (!listAddressRes.ok || !listAddressData.success || listAddressData.data.length === 0) {
      throw new Error("Failed GET /addresses test");
    }
    console.log("✅ GET /addresses test passed!\n");

    // 5. Test PUT /addresses
    console.log("⏳ 5. Fully updating Address (PUT)...");
    const putAddressRes = await fetch(`${BASE_URL}/api/customer-app/addresses?id=${addressId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        fullName: "Jaswanth G",
        label: "Work",
        phone: testPhone,
        addressLine1: "999 Office Plaza",
        city: "Houston",
        state: "Texas",
        pincode: "77001",
        isDefault: true
      })
    });
    console.log("PUT Response status:", putAddressRes.status);
    const putAddressText = await putAddressRes.text();
    console.log("PUT Response text:", putAddressText);
    const putAddressData = JSON.parse(putAddressText);
    console.log("Response:", JSON.stringify(putAddressData, null, 2));
    if (!putAddressRes.ok || !putAddressData.success || putAddressData.data.label !== "Work") {
      throw new Error("Failed PUT /addresses test");
    }
    console.log("✅ PUT /addresses test passed!\n");

    // 6. Test PATCH /addresses
    console.log("⏳ 6. Partially updating Address (PATCH)...");
    const patchAddressRes = await fetch(`${BASE_URL}/api/customer-app/addresses?id=${addressId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        fullName: "Jaswanth Office"
      })
    });
    const patchAddressData = await patchAddressRes.json();
    console.log("Response:", JSON.stringify(patchAddressData, null, 2));
    if (!patchAddressRes.ok || !patchAddressData.success || patchAddressData.data.fullName !== "Jaswanth Office") {
      throw new Error("Failed PATCH /addresses test");
    }
    console.log("✅ PATCH /addresses test passed!\n");

    // 7. Test DELETE /addresses
    console.log("⏳ 7. Deleting Address (DELETE)...");
    const deleteAddressRes = await fetch(`${BASE_URL}/api/customer-app/addresses?id=${addressId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    });
    const deleteAddressData = await deleteAddressRes.json();
    console.log("Response:", JSON.stringify(deleteAddressData, null, 2));
    if (!deleteAddressRes.ok || !deleteAddressData.success) {
      throw new Error("Failed DELETE /addresses test");
    }
    console.log("✅ DELETE /addresses test passed!\n");

    // 8. Verify deletion on GET /addresses
    console.log("⏳ 8. Verifying deletion...");
    const verifyDeleteRes = await fetch(`${BASE_URL}/api/customer-app/addresses`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });
    const verifyDeleteData = await verifyDeleteRes.json();
    console.log("Response:", JSON.stringify(verifyDeleteData, null, 2));
    if (!verifyDeleteRes.ok || verifyDeleteData.data.length !== 0) {
      throw new Error("Failed deletion verification");
    }
    console.log("✅ Deletion verification passed!\n");

    console.log("🏆 ALL CUSTOMER APIs WORKED PERFECTLY END-TO-END!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  }
}

runTests();
