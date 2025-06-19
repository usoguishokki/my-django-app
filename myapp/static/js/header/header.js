
import { setupLoadingOnLinkClick, showLoadingScreen  } from '../manager/loadingManager.js';

document.addEventListener('DOMContentLoaded', () => {
    setupLoadingOnLinkClick ()
    const siteHeader = document.querySelector(".m-site");
    const dynamicLinks = siteHeader.querySelector(".dynamic-links");
    const employeeName = document.getElementById("employeeName");
    const userProfile = employeeName.querySelector(".user-profile");

    let isVisible = false;
    let hideTimeout;

    const showLinks = (element) => {
        clearTimeout(hideTimeout);
        if (!isVisible) {
            isVisible = true;
            element.classList.add("visible");
            element.setAttribute("aria-hidden", "false");
            element.setAttribute("aria-expanded", "true")
            console.log(`[DEBUG] ${element.classList}を表示`);
        }
    };

    const hideLinks = (element) => {
        hideTimeout = setTimeout(() => {
            if (isVisible) {
                isVisible = false;
                element.classList.remove("visible");
                element.setAttribute("aria-hidden", "true");
                element.setAttribute("aria-expanded", "false");
                console.log(`[DEBUG]${element.classList}を非表示`);
            }
        }, 200);
    };

    siteHeader.addEventListener("mouseenter", () => showLinks(dynamicLinks));
    siteHeader.addEventListener("focusin", () => showLinks(dynamicLinks));
    // `dynamic-links` にホバーした場合
    dynamicLinks.addEventListener("mouseenter", () => showLinks(dynamicLinks));

    siteHeader.addEventListener("mouseleave", (event) => {
        if (!event.relatedTarget || !siteHeader.contains(event.relatedTarget)) {
            hideLinks(dynamicLinks);
        }
    });

    // `dynamic-links` からホバーが外れる場合
    dynamicLinks.addEventListener("mouseleave", (event) => {
        if (!event.relatedTarget || !dynamicLinks.contains(event.relatedTarget)) {
            hideLinks(dynamicLinks);
        }
    });

    // `m-site` からフォーカスが外れる場合
    siteHeader.addEventListener("focusout", (event) => {
        if (!event.relatedTarget || !siteHeader.contains(event.relatedTarget)) {
            hideLinks(dynamicLinks);
        }
    });

    employeeName.addEventListener("mouseenter", () => showLinks(userProfile));
    employeeName.addEventListener("focusin", () => showLinks(userProfile));

    employeeName.addEventListener("mouseleave", (event) => {
        if (!event.relatedTarget || !employeeName.contains(event.relatedTarget)) {
            hideLinks(userProfile)
        }
    });
    
    employeeName.addEventListener("focusout", (event) => {
        if (!event.relatedTarget || !employeeName.contains(event.relatedTarget)) {
            hideLinks(userProfile);
        }
    });
    
    document.addEventListener("click", (event) => {
        //
        if (!siteHeader.contains(event.target) && isVisible) {
            hideLinks(dynamicLinks);
        }
        if (!employeeName.contains(event.target) && isVisible) {
            hideLinks(userProfile)
        }
    });
})